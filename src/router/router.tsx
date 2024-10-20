import {createBrowserRouter} from "react-router-dom";
import App from "../App";
import React from "react";
import {Room} from "../pages/room";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App/>,
    },
    {
        path: "/room/:id",
        element: <Room/>,
    },
]);