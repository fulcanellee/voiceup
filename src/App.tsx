import React, {useEffect, useRef, useState} from 'react';
import './App.css';
import {socket} from "./socket";
import {EVENTS} from './common/events'
import {useNavigate} from "react-router-dom";
import {v4} from 'uuid';

function App() {
    const navigate = useNavigate();
    const [rooms, updateRooms] = useState([]);
    const rootNode = useRef(null);

    useEffect(() => {
        socket.on(EVENTS.EMIT_ROOMS, ({rooms = []}) => {
            if (rootNode.current) {
                updateRooms(rooms)
            }
        });
    }, []);

    const handleJoinRoom = (roomID: string) => {
        navigate(`/room/${roomID}`)
    }

    const handleCreateRoom = () => {
        navigate(`/room/${v4()}`)
    }

    return (
        <div className="App" ref={rootNode}>
            <h1>Available rooms</h1>
            <ul>
                {rooms.map(roomID => {
                    return <li key={roomID}>
                        {roomID}
                        <button type='button' onClick={() => handleJoinRoom(roomID)}>Join room</button>
                    </li>
                })}
            </ul>

            <button type='button' onClick={handleCreateRoom}>Create new room</button>
        </div>
    );
}

export default App;
