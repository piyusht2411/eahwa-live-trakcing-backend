"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: [
                "http://localhost:3000",
                "https://eashwa-frontend-iptp.vercel.app",
                "https://eashwastock.in",
                "https://www.eashwastock.in",
                "https://eashwa-live-tracking-admin.vercel.app",
                "https://chilweeindia.com",
                "https://www.chilweeindia.com",
            ],
            credentials: true,
        },
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io)
        throw new Error("Socket.io not initialized");
    return io;
};
exports.getIO = getIO;
