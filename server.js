// npm install ws mysql2 bcrypt express dotenv

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import url from "url";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// =====================================================
// MYSQL
// =====================================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "big_leagues",
    waitForConnections: true,
    connectionLimit: 10
});

// =====================================================
// EXPRESS — dient das gebaute Frontend (Vite "dist" Ordner)
// =====================================================
const app = express();

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});

const server = http.createServer(app);

// =====================================================
// WEBSOCKET SERVER — zwei Pfade: /auth und /ws
// =====================================================
const authWss = new WebSocketServer({ noServer: true });
const gameWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
    const { pathname } = url.parse(request.url);

    if (pathname === "/auth") {
        authWss.handleUpgrade(request, socket, head, (ws) => {
            authWss.emit("connection", ws, request);
        });
    } else if (pathname === "/ws") {
        gameWss.handleUpgrade(request, socket, head, (ws) => {
            gameWss.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});

// =====================================================
// AUTH LOGIC
// =====================================================
authWss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            ws.send(JSON.stringify({ success: false, message: "Ungültige Daten" }));
            return;
        }

        if (data.type === "signup") {
            if (!data.username || !data.password) {
                ws.send(JSON.stringify({ success: false, message: "Username und Passwort erforderlich" }));
                return;
            }
            try {
                const hashed = await bcrypt.hash(data.password, 10);
                await pool.query(
                    "INSERT INTO users (username, password) VALUES (?, ?)",
                    [data.username, hashed]
                );
                ws.send(JSON.stringify({ success: true }));
            } catch (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    ws.send(JSON.stringify({ success: false, message: "Username bereits vergeben" }));
                } else {
                    console.error(err);
                    ws.send(JSON.stringify({ success: false, message: "Serverfehler" }));
                }
            }
        }

        if (data.type === "login") {
            try {
                const [rows] = await pool.query(
                    "SELECT * FROM users WHERE username = ?",
                    [data.username]
                );
                if (rows.length === 0) {
                    ws.send(JSON.stringify({ success: false, message: "User nicht gefunden" }));
                    return;
                }
                const match = await bcrypt.compare(data.password, rows[0].password);
                ws.send(JSON.stringify({
                    success: match,
                    message: match ? "" : "Falsches Passwort"
                }));
            } catch (err) {
                console.error(err);
                ws.send(JSON.stringify({ success: false, message: "Serverfehler" }));
            }
        }
    });
});

// =====================================================
// GAME LOGIC — Lobby mit max. 2 Spielern, Host = erster Beitretende
// =====================================================
let lobby = []; // Array von { ws, isHost }

gameWss.on("connection", (ws) => {
    const isHost = lobby.length === 0;

    if (lobby.length >= 2) {
        ws.close(1013, "Lobby voll");
        return;
    }

    lobby.push({ ws, isHost });

    ws.send(JSON.stringify({
        type: "lobby_connect",
        isHost,
        lobbyId: "lobby-1"
    }));

    ws.on("message", (raw) => {
        // Alle Spiel-Nachrichten (move, input, ballState, score, pause, attached)
        // einfach an den/die anderen Client(s) weiterreichen
        for (const client of lobby) {
            if (client.ws !== ws && client.ws.readyState === 1) {
                client.ws.send(raw);
            }
        }
    });

    ws.on("close", () => {
        lobby = lobby.filter((client) => client.ws !== ws);
        // Optional: bei Verbindungsabbruch könnte man hier die Lobby zurücksetzen
        // oder den verbleibenden Client informieren
    });
});

// =====================================================
// START
// =====================================================

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server läuft auf Port ${PORT} (Pfade: /auth, /ws, statisches Frontend aus /dist)`);
});