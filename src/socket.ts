import { Server } from "socket.io";

let io: Server;

export const initSocket = (server: any): Server => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "https://test-frontend-iptp.vercel.app",
        "https://teststock.in",
        "https://www.teststock.in",
        "https://test-live-tracking-admin.vercel.app",
        "https://chilweeindia.com",
        "https://www.chilweeindia.com",
      ],
      credentials: true,
    },
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
