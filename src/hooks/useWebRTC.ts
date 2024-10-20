import useStateWithCallback from "./useStateWithCallback";
// @ts-ignore
import freeice from 'freeice';
import {useCallback, useEffect, useRef} from "react";
import {socket} from "../socket";
import {EVENTS} from "../common/events";

export const LOCAL_VIDEO = 'LOCAL_VIDEO';

// todo refactor
export default function useWebRTC(roomID: string) {
    const [clients, updateClients] = useStateWithCallback([]);

    const addNewClient = useCallback((newClient: any, cb: any) => {
        updateClients((list: any) => {
            if (!list.includes(newClient)) {
                return [...list, newClient]
            }

            return list;
        }, cb);
    }, [clients, updateClients]);

    const peerConnections = useRef({});
    const localMediaStream = useRef(null);
    const peerMediaElements = useRef({
        [LOCAL_VIDEO]: null,
    });

    useEffect(() => {
        async function handleNewPeer({peerID, createOffer}: any) {
            if (peerID in peerConnections.current) {
                return console.warn(`Already connected to peer ${peerID}`);
            }

            // @ts-ignore
            peerConnections.current[peerID] = new RTCPeerConnection({
                iceServers: freeice(),
            });

            // @ts-ignore
            peerConnections.current[peerID].onicecandidate = (event: any) => {
                if (event.candidate) {
                    socket.emit(EVENTS.RELAY_ICE, {
                        peerID,
                        iceCandidate: event.candidate,
                    });
                }
            }

            let tracksNumber = 0;
            // @ts-ignore
            peerConnections.current[peerID].ontrack = ({streams: [remoteStream]}) => {
                tracksNumber++

                if (tracksNumber === 2) { // video & audio tracks received
                    tracksNumber = 0;
                    addNewClient(peerID, () => {
                        // @ts-ignore
                        if (peerMediaElements.current[peerID]) {
                            // @ts-ignore
                            peerMediaElements.current[peerID].srcObject = remoteStream;
                        } else {
                            // FIX LONG RENDER IN CASE OF MANY CLIENTS
                            let settled = false;
                            const interval = setInterval(() => {
                                // @ts-ignore
                                if (peerMediaElements.current[peerID]) {
                                    // @ts-ignore
                                    peerMediaElements.current[peerID].srcObject = remoteStream;
                                    settled = true;
                                }

                                if (settled) {
                                    clearInterval(interval);
                                }
                            }, 1000);
                        }
                    });
                }
            }

            // @ts-ignore
            localMediaStream.current.getTracks().forEach((track: any) => {
                // @ts-ignore
                peerConnections.current[peerID].addTrack(track, localMediaStream.current);
            });

            if (createOffer) {
                // @ts-ignore
                const offer = await peerConnections.current[peerID].createOffer();

                // @ts-ignore
                await peerConnections.current[peerID].setLocalDescription(offer);

                socket.emit(EVENTS.RELAY_SDP, {
                    peerID,
                    sessionDescription: offer,
                });
            }
        }

        socket.on(EVENTS.ADD_PEER, handleNewPeer);

        return () => {
            socket.off(EVENTS.ADD_PEER);
        }
    }, []);

    useEffect(() => {
        async function setRemoteMedia({peerID, sessionDescription: remoteDescription}: any) {
            // @ts-ignore
            await peerConnections.current[peerID]?.setRemoteDescription(
                new RTCSessionDescription(remoteDescription)
            );

            if (remoteDescription.type === 'offer') {
                // @ts-ignore
                const answer = await peerConnections.current[peerID].createAnswer();

                // @ts-ignore
                await peerConnections.current[peerID].setLocalDescription(answer);

                socket.emit(EVENTS.RELAY_SDP, {
                    peerID,
                    sessionDescription: answer,
                });
            }
        }

        socket.on(EVENTS.SESSION_DESCRIPTION, setRemoteMedia)

        return () => {
            socket.off(EVENTS.SESSION_DESCRIPTION);
        }
    }, []);


    useEffect(() => {
        socket.on(EVENTS.ICE_CANDIDATE, ({peerID, iceCandidate}) => {
            // @ts-ignore
            peerConnections.current[peerID]?.addIceCandidate(
                new RTCIceCandidate(iceCandidate)
            );
        });

        return () => {
            socket.off(EVENTS.ICE_CANDIDATE);
        }
    }, []);

    useEffect(() => {
        const handleRemovePeer = ({peerID}: any) => {
            // @ts-ignore
            if (peerConnections.current[peerID]) {
                // @ts-ignore
                peerConnections.current[peerID].close();
            }

            // @ts-ignore
            delete peerConnections.current[peerID];
            // @ts-ignore
            delete peerMediaElements.current[peerID];

            updateClients((list: any) => list.filter((c: any) => c !== peerID));
        };

        socket.on(EVENTS.REMOVE_PEER, handleRemovePeer);

        return () => {
            socket.off(EVENTS.REMOVE_PEER);
        }
    }, []);


    useEffect(() => {
        /** захват видео аудио */
        async function startCapture() {
            // @ts-ignore
            localMediaStream.current = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: 1280,
                    height: 720,
                }
            });

            /** трансляция на экран */
            addNewClient(LOCAL_VIDEO, () => {
                // @ts-ignore
                const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

                if (localVideoElement) {
                    // @ts-ignore
                    localVideoElement.volume = 0;
                    // @ts-ignore
                    localVideoElement.srcObject = localMediaStream.current;
                }
            });
        }

        startCapture()
            .then(() => socket.emit(EVENTS.JOIN, {room: roomID}))
            .catch(e => console.error('Error getting userMedia:', e));

        return () => {
            // @ts-ignore
            localMediaStream.current.getTracks().forEach(track => track.stop());

            socket.emit(EVENTS.LEAVE_ROOM);
        };
    }, [roomID])

    const provideMediaRef = useCallback((id: any, node: any) => {
        // @ts-ignore
        peerMediaElements.current[id] = node;
    }, []);

    return {clients, provideMediaRef}
}