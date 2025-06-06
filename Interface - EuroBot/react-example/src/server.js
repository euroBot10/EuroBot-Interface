// server.js
import express from "express";
import cors from "cors";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import kill from "kill-port"; // mata a porta 8888

// === Reconstrói __dirname em ES module ===
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Caminho pro executável (coloque o .exe na mesma pasta deste server.js)
const exePath = path.join(__dirname, "pynetworktables2js.exe");

const app  = express();
const port = 3001;

// Função que mata qualquer instância anterior que esteja usando a porta 8888
async function killPrevious(callback) {
  try {
    await kill(8888, "tcp");
  } catch {
    // se já estiver livre, segue em frente
  }
  callback();
}

app.use(cors());

// Rota para conectar via cabo (IP 172.22.11.2)
app.get("/start-nt/cable", (req, res) => {
  killPrevious(() => {
    const ip  = "172.22.11.2";
    const cmd = `"${exePath}" --robot ${ip}`;
    exec(cmd, (err, stdout) => {
      if (err) return res.status(500).send(`Erro: ${err.message}`);
      res.send(`NT iniciado (cabo) em ${ip}`);
    });
  });
});

// Rota para conectar via Wi-Fi (IP 10.12.34.2)
app.get("/start-nt/wifi", (req, res) => {
  killPrevious(() => {
    const ip  = "10.12.34.2";
    const cmd = `"${exePath}" --robot ${ip}`;
    exec(cmd, (err, stdout) => {
      if (err) return res.status(500).send(`Erro: ${err.message}`);
      res.send(`NT iniciado (Wi-Fi) em ${ip}`);
    });
  });
});

app.listen(port, () => {
  console.log(`Server rodando em http://localhost:${port}`);
});
