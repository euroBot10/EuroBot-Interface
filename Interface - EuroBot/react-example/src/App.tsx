// App.tsx
import { useState, useRef, useEffect} from "react";
import {
  useNTValue,
  useNTConnection,
  useRobotConnection,
} from "./nt3/useNetworktables";
import "./index.css";
import "@frc-web-components/fwc"
import Lua from "./assets/lua.png"
import Sol from "./assets/brilho-do-sol.png"
import Cadeado from "./assets/cadeado-trancado.png"
import {
  getElapsedTime,
  metaStore,
  photoStore,
  setElapsedTimeRemote,
  getLowStart,
  setLowStart as setLowStartRemote, // Renomeado para evitar conflito com o setter do useState
  getCountdown,
  setCountdown as setCountdownRemote, // Renomeado para evitar conflito com o setter do useState
} from './storage';



function App() {
  // NetworkTables connections
  const isConnected = useNTConnection();
  const isRobotConnected = useRobotConnection();
  const [, setStatusMessage] = useState('');

  // Dashboard values
  const [resolution, setResolution] = useNTValue<string>(
  "/SmartDashboard/CameraResolution",
  "1080p"
);
    const [temp] = useNTValue<number>("/SmartDashboard/RobotTemp", 0);
    const [roll] = useNTValue<number>("/SmartDashboard/Roll", 0);
  const [encoderValue] = useNTValue<number>("/SmartDashboard/encoder_EixoY", 0);
  const [cargaValue] = useNTValue<number>("/SmartDashboard/carga", 0);
  const [gyroValue] = useNTValue<number>("/SmartDashboard/Gyro", 0);
  const [, setResetEncoder] = useNTValue<boolean>("/SmartDashboard/ResetEncoder", false);
  const [zoom, setZoom] = useNTValue<number>("/SmartDashboard/CameraZoom", 100);
  const [brightness, setBrightness] = useNTValue<number>("/SmartDashboard/CameraBrightness", 50);
  // Estado para IP da câmera
    const [cameraIP, setCameraIP] = useState<string>("10.12.34.2");
    const [streamUrl, setStreamUrl] = useState(
    `http://10.12.34.2:1181/?action=stream&_=${Date.now()}`
  );
  const [loadingCam, setLoadingCam] = useState(true);
    const API_BASE = "http://localhost:3001";


    /* Fullscreen dos ícones                                     */

    // Estado do lightbox
const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

// Abre o lightbox
const openLightbox = (url: string) => setLightboxUrl(url);

// Fecha o lightbox
const closeLightbox = () => setLightboxUrl(null);


  async function loadLast3Photos(): Promise<string[]> {
    const rawKeys = await photoStore.keys();
    const sortedKeys = rawKeys
      .map(k => {
        const m = k.match(/^foto-(\d+)\.jpg$/);
        if (!m) return null;
        return { key: k, ts: Number(m[1]) };
      })
      .filter((x): x is { key: string; ts: number } => !!x)
      .sort((a, b) => a.ts - b.ts) // Ordena por timestamp crescente
      .map(x => x.key);

    const last3 = sortedKeys.slice(-3); // Pega as 3 últimas chaves
    const urls: string[] = [];
    for (const key of last3) {
      const blob = await photoStore.getItem<Blob>(key);
      if (blob) urls.unshift(URL.createObjectURL(blob)); // Adiciona ao início para ordem decrescente
    }
    return urls;
  }

/* Cache das Fotos nos ícones                                  */

useEffect(() => {
  // só chama a nossa função utilitária:
  loadLast3Photos().then(setCapturedPhotos);
}, []);
    

/* FullScreen                                         */

  // 1) Ref para o container da câmera
  const cameraContainerRef = useRef<HTMLDivElement>(null);
  // 2) State que acompanha o modo fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 3) Handler para togglar fullscreen
  const toggleFullscreen = () => {
    if (!cameraContainerRef.current) return;
    if (!isFullscreen) {
      cameraContainerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // 4) Captura o evento de mudança de fullscreen (caso o usuário aperte ESC, etc)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);


/* Aviso da Bateria Low                                     */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // MODIFICADO: lowStart e countdown iniciam como null
  const [lowStart, setLowStart] = useState<number | null>(null); // Continua a marcar o início da queda de voltagem
  const [countdown, setCountdown] = useState<number | null>(null); // Tempo restante em segundos
  const [blink, setBlink] = useState(false); // Para efeito de piscando crítico

  // ADICIONADO: Constantes para os limiares de voltagem e duração
  const LOW_VOLTAGE_THRESHOLD_START_COUNTDOWN = 12.0; // Voltagem para iniciar contagem regressiva
  const RECOVERY_VOLTAGE_THRESHOLD = 12.30; // Voltagem para zerar todos os avisos
  const COUNTDOWN_DURATION_SECONDS = 5 * 60; // 5 minutos (300 segundos)

  // ADICIONADO: Carrega lowStart do IndexedDB ao montar
  useEffect(() => {
    getLowStart().then(setLowStart);
  }, []);

  // ADICIONADO: Salva lowStart no IndexedDB sempre que ele mudar
  useEffect(() => {
    setLowStartRemote(lowStart);
  }, [lowStart]);

  // ADICIONADO: Carrega countdown do IndexedDB ao montar
  useEffect(() => {
    getCountdown().then(setCountdown);
  }, []);

  // ADICIONADO: Salva countdown no IndexedDB sempre que ele mudar
  useEffect(() => {
    setCountdownRemote(countdown);
  }, [countdown]);


  // Lógica principal para o status da bateria
  useEffect(() => {
    // Reseta todos os avisos de bateria se o robô desconectar
    if (!isRobotConnected) {
      setLowStart(null);
      setCountdown(null);
      setBlink(false);
      return;
    }

    const voltage = cargaValue ?? 0;

    // Caso 1: Voltagem caiu ABAIXO do limiar para iniciar a contagem regressiva
    if (voltage < LOW_VOLTAGE_THRESHOLD_START_COUNTDOWN) {
      if (lowStart === null) {
        setLowStart(Date.now()); // Marca o momento em que a voltagem caiu pela primeira vez
      }
      // Se a contagem regressiva ainda não estiver rodando, inicia IMEDIATAMENTE por 5 minutos
      if (countdown === null) {
        setCountdown(COUNTDOWN_DURATION_SECONDS);
        setBlink(false); // Garante que não está piscando quando a contagem começa
      }
    }
    // Caso 2: Voltagem se RECUPEROU ACIMA do limiar de recuperação
    else if (voltage >= RECOVERY_VOLTAGE_THRESHOLD) {
      // Limpa todos os avisos e a contagem regressiva
      setLowStart(null);
      setCountdown(null);
      setBlink(false);
    }
    // Caso 3: Voltagem está ENTRE LOW_VOLTAGE_THRESHOLD_START_COUNTDOWN e RECOVERY_VOLTAGE_THRESHOLD
    // (ex: 12.0 <= voltage < 12.30). Neste caso, se a contagem regressiva já estiver ativa, ela continua.
    // Se não estiver ativa, não é iniciada. Nenhuma ação explícita é necessária aqui, o estado persiste.
  }, [cargaValue, isRobotConnected, lowStart, countdown]); // Dependências corrigidas

  // Efeito para decrementar o timer de contagem regressiva
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown !== null && countdown <= 0) { // Se a contagem regressiva chegou a 0
        setBlink(true); // Ativa o efeito de piscando crítico
      }
      return;
    }

    const id = setInterval(() => {
      setCountdown((t) => (t !== null ? t - 1 : null));
    }, 1000);

    return () => clearInterval(id); // Limpa o intervalo ao desmontar ou mudar dependências
  }, [countdown]);

// Formato do tempo
  const formatMMSS = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0"
    )}`;


//////////////////////////////////////////////////////////////////////////////////////////////////////////
/* funções para IP da Câmera e imagem                                   */

  // Este useEffect agora apenas atualiza a URL do stream
  // quando o cameraIP mudar ou um erro de carregamento ocorrer.
  // REMOVIDO o `setInterval` de 1 segundo de recarga forçada.
  useEffect(() => {
    // Atualiza a URL do stream APENAS quando o cameraIP muda
    setStreamUrl(`http://${cameraIP}:1181/?action=stream&_=${Date.now()}`);
    setLoadingCam(true); // Indica que o carregamento da câmera iniciou
  }, [cameraIP]); // Depende apenas de cameraIP

const handleImageLoad = () => {
  setLoadingCam(false); // Marque como carregado
};

const handleImageError = () => {
  console.error("Erro ao carregar o stream de imagem. Tentando recarregar...");
  setLoadingCam(true); // Em caso de erro, tenta recarregar novamente
  // Adiciona um pequeno atraso antes de tentar recarregar a URL do stream
  // Isso evita loops de erro muito rápidos
  setTimeout(() => {
    setStreamUrl(`http://${cameraIP}:1181/?action=stream&_=${Date.now()}`);
  }, 2000); // Tenta recarregar após 2 segundos
};



/* // Theme (Light/Dark)                                     */


  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );

  // adiciona imediatamente após o const [theme,...]
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
}, [theme]);


  const [, setCurrentTime] = useState(new Date());
useEffect(() => {
  const interval = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(interval);
}, []);


/* Timer de inspeção                                         */

  const [isRunning, setIsRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

    // 1) carrega do IndexedDB na montagem
  useEffect(() => {
    getElapsedTime().then(saved => setElapsedTime(saved));
  }, []);

  // 2) persiste sempre que mudar
  useEffect(() => {
    setElapsedTimeRemote(elapsedTime);
  }, [elapsedTime]);


  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

/* Captura de fotos                                     */

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

                                      // Handlers
                                      // Dentro de App(), logo após os outros useState:
const [showForm, setShowForm] = useState(false);

const [meta, setMeta] = useState<{ cliente: string; parque: string; equipe: string; turbina: string; modelo: string }>(
    { cliente: '', parque: '', equipe: '', turbina: '', modelo: '' }
  );
  useEffect(() => {
    metaStore.getItem<typeof meta>('inspecaoMeta').then(saved => {
      if (saved) setMeta(saved);
    });
  }, []);

const handleOpenForm = () => setShowForm(true);

const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await metaStore.setItem('inspecaoMeta', meta);
    setShowForm(false);
    handleStart();
  };

  const handleStart = () => setIsRunning(true);
  const handleStop = () => setIsRunning(false);


  const handleResetEncoder = () => {
    if (!isRunning) {
      setResetEncoder(true);
      setTimeout(() => setResetEncoder(false), 2000);
    }
  };


  const handleTakePhoto = async () => {
    const img = document.getElementById('camera') as HTMLImageElement;
    if (!img) return;
    const canvas = document.createElement('canvas');
    // Usar as dimensões naturais da imagem para a captura
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);


    const now = new Date(); const pad = (n:number)=>n.toString().padStart(2,'0');
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ` +
                  `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    ctx.font='36px Sansita One'; ctx.lineWidth=10;
    ctx.strokeStyle = theme==='light'?'black':'white'; ctx.fillStyle = theme==='light'?'white':'black';
    ctx.textAlign='left'; ctx.strokeText(`Deslocamento Eixo Z: ${encoderValue?.toFixed(2)} mm`,10,canvas.height-20);
    ctx.fillText(`Deslocamento Eixo Z: ${encoderValue?.toFixed(2)} mm`,10,canvas.height-20);
    ctx.textAlign='right'; ctx.strokeText(stamp,canvas.width-10,canvas.height-20);
    ctx.fillText(stamp,canvas.width-10,canvas.height-20);

  // desenha os metadados em linhas, com fundo preto semitransparente
const lines = [
  `Cliente: ${meta.cliente}`,
  `Parque: ${meta.parque}`,
  `Equipe: ${meta.equipe}`,
  `Turbina: ${meta.turbina}`,
  `Modelo: ${meta.modelo}`
];
ctx.font = '22px Sansita One';
ctx.textAlign = 'right';
ctx.textBaseline = 'top';

const padding = 8;
const lineHeight = 32;

// medir largura máxima

// calcular retângulo
const boxHeight = lines.length * lineHeight + padding * 2;
// calcular retângulo (com offset extra para cima)
  const extraOffset = 70; // sobe a caixa em mais 40px
  const boxY = canvas.height - 10 - boxHeight - extraOffset;

// desenhar fundo preto semitransparente

// desenhar texto
ctx.lineWidth = 8;
ctx.strokeStyle = 'black';
ctx.fillStyle   = 'white';

lines.forEach((l, i) => {
  const x = canvas.width - 10 - padding;
  const y = boxY + padding + i * lineHeight;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // primeiro contorno
  ctx.strokeText(l, x, y);
  // depois o preenchimento
  ctx.fillText(l, x, y);})

///////////////////////////////////////////////////

    const blob = await new Promise<Blob>(resolve =>
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.7) // Comprime a imagem para 70% de qualidade
    );

  const sanitize = (str: string) =>
    str.trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  const clienteSlug = sanitize(meta.cliente);
  const turbinaSlug = sanitize(meta.turbina);
  const fileTimestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}` +
  `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const fileName = `foto_${clienteSlug}_${turbinaSlug}_${fileTimestamp}.jpg`;


// 1) Salva no IndexedDB com key padrão
const key = `foto-${Date.now()}.jpg`;
await photoStore.setItem(key, blob);

// ADICIONADO: Lógica para limpar fotos antigas do IndexedDB (mantém apenas as 3 mais recentes)
const MAX_PHOTOS_TO_KEEP = 3;
const allRawKeys = await photoStore.keys();
const allSortedPhotos = allRawKeys
  .map(k => {
    const m = k.match(/^foto-(\d+)\.jpg$/);
    if (!m) return null;
    return { key: k, ts: Number(m[1]) };
  })
  .filter((x): x is { key: string; ts: number } => !!x)
  .sort((a, b) => a.ts - b.ts); // Ordena por timestamp crescente

if (allSortedPhotos.length > MAX_PHOTOS_TO_KEEP) {
  const keysToDelete = allSortedPhotos.slice(0, allSortedPhotos.length - MAX_PHOTOS_TO_KEEP);
  for (const item of keysToDelete) {
    await photoStore.removeItem(item.key);
  }
}

// 2) Atualiza a lista de miniaturas
const urls = await loadLast3Photos(); // Chama loadLast3Photos para buscar as 3 mais recentes após a limpeza
setCapturedPhotos(urls);

// Limpa URLs de objeto antigas que podem ter sido criadas anteriormente para liberar memória
capturedPhotos.forEach(url => URL.revokeObjectURL(url));


    // download imediato
    const dataURL = canvas.toDataURL();
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = fileName;
    link.click();
  };

//////////////////////////////////////////////////////////////////////////////////////////////////////////

  const connectCable = async () => {
    try {
      const msg = await fetch(`${API_BASE}/start-nt/cable`).then(r => r.text());
      setStatusMessage(msg);
      setCameraIP("172.22.11.2");
            setLoadingCam(true);
    } catch {
      setStatusMessage("Falha ao conectar (cabo)");
    }
  };


  const connectWifi = async () => {
    try {
      const msg = await fetch(`${API_BASE}/start-nt/wifi`).then(r => r.text());
      setStatusMessage(msg);
      setCameraIP("10.12.34.2");
            setLoadingCam(true);

    } catch {
      setStatusMessage("Falha ao conectar (Wi‑Fi)");
    }
  };
  
  
  // Battery status renderer
  const renderBatteryStatus = () => {
    const currentVoltage = cargaValue ?? 0;
    if (currentVoltage >= RECOVERY_VOLTAGE_THRESHOLD) {
      return <div className="battery-status normal" style={{fontSize: "25px", textAlign: "center"}}>✅ Voltagem Apropriada</div>;
    }
    if (currentVoltage < LOW_VOLTAGE_THRESHOLD_START_COUNTDOWN) {
      return <div className="battery-status low" style={{fontSize: "25px", textAlign: "center"}}>❌ Voltagem Crítica</div>;
    }
    // Se a voltagem estiver entre o limiar de queda e o de recuperação
    return <div className="battery-status warning" style={{fontSize: "25px", textAlign: "center", color: "orange"}}>⚠️ Voltagem Baixa</div>;
  };

  // Formato da Data e hora
    const formatTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}` +
    `:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` +
    `:${String(s % 60).padStart(2, "0")}`;




let barColor = 'green';
if (temp ?? 0 >= 70) {barColor = 'orange';}

else if (temp ?? 0 >= 50) {barColor = 'yellow';}

else if (temp ?? 0 >= 80) {barColor == 'red'}


  return (
    <div className="app-container">
    
{showForm && (
  <div className="form-overlay">
    <div className="form-container">
      {/* Botão fechar (X) */}
      <button
        className="form-close-btn"
        onClick={() => {
          setShowForm(false);
          setMeta({cliente:'',parque:'',equipe:'',turbina:'',modelo:''});
        }}
        aria-label="Fechar formulário"
      >
        ×
      </button>

      <form className="inspection-form" onSubmit={handleSubmitForm}>
        <h2>Dados da Inspeção</h2>
        <input placeholder="Cliente"   value={meta.cliente}   onChange={e => setMeta({...meta, cliente: e.target.value})} required/>
        <input placeholder="Parque"     value={meta.parque}    onChange={e => setMeta({...meta, parque:    e.target.value})} required/>
        <input placeholder="Equipe"     value={meta.equipe}    onChange={e => setMeta({...meta, equipe:    e.target.value})} required/>
        <input placeholder="Turbina"    value={meta.turbina}   onChange={e => setMeta({...meta, turbina:   e.target.value})} required/>
        <input placeholder="Modelo"     value={meta.modelo}    onChange={e => setMeta({...meta, modelo:    e.target.value})} required/>

        <div className="form-actions">
          {/* Botão reset ⟲ */}
          <button
            type="button"
            className="btn reset-form-btn"
            onClick={() => setMeta({cliente:'',parque:'',equipe:'',turbina:'',modelo:''})}
            title="Limpar tudo"
          >
            ⟲ Limpar
          </button>
          <button type="submit" className="btn">Enviar</button>
        </div>
      </form>
    </div>
  </div>
)}


 {/* === Grupo de botões Sol / Lua === */}
<div className="theme-toggle-group">
        <button
          className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
          aria-label="Modo claro"
          style={{left: "30px"}}
        >
          <img src={Sol} alt="Sol" className="theme-icon" />
        </button>
        <button
          className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
          aria-label="Modo escuro"
          style={{left: "-30px"}}
        >
          <img src={Lua} alt="Lua" className="theme-icon" />
        </button>
      </div>





  <div className="connection-info">
    <div>Dados do Robô: {isConnected ? '✅' : '❌'}</div>
    <div>Conexão do Robô: {isRobotConnected ? '✅' : '❌'}</div>
  </div>
      
 {/* === ALERTAS DE VOLTAGEM === */}
      {/* O alerta de "Tempo de vida do robô acabando" que dependia do delay de lowStart foi removido,
          pois o novo requisito é iniciar o countdown de 5 minutos imediatamente. */}
      {/* {countdown === null &&
        lowStart !== null &&
        Date.now() - lowStart >= 20 * 1000 && (
          <div className="voltage-alert">
            <span className="alert-icon">⚠️</span>
            <span className="alert-text">
              Tempo de vida do robô acabando
            </span>
          </div>
        )} */}
      
      {countdown !== null && countdown > 0 && (
        <div className="voltage-countdown">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">
            Robô em estágio final! Volte para a zona de conforto em{" "}
            {formatMMSS(countdown)}
          </span>
        </div>
      )}
      {blink && (
        <div className="voltage-countdown blink">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">
            ESTÁGIO CRÍTICO! Reinicie agora!
          </span>
        </div>
      )}



      {/* Main Layout */}
      <main className="conteudo">
        <section className="controls-container">
          <button className="btn start-btn" onClick={handleOpenForm} disabled={isRunning}>Iniciar Inspeção</button>
          <button className="btn stop-btn" onClick={handleStop} disabled={!isRunning}>Parar Inspeção</button>
<div className="timer-with-reset">
  <div className="timer">Tempo: {formatTime(elapsedTime)}

    <button
    className="timer-reset-btn"
    onClick={() => setElapsedTime(0)}
    title="Zerar cronômetro"
    aria-label="Zerar cronômetro"
  >
    ⟳
  </button>
  </div>
  
</div>          
<button className="btn reset-btn" onClick={handleResetEncoder} disabled={isRunning}>Resetar Deslocamento {isRunning && (
    <img
      src={Cadeado}
      alt="Bloqueado"
      style={{
        width: 20,
        height: 20,
        marginLeft: 8,
        verticalAlign: "middle"
      }}
    />
  )}</button>
          <button className="btn take-photo-btn" onClick={handleTakePhoto}>Tirar Foto</button>
          

          <button className="btn start-nt-btn" onClick={connectCable}>
    Conectar via Cabo
  </button>
  <button className="btn start-nt-btn" onClick={connectWifi}>
    Conectar via Wi-fi
  </button>

          <br />
          <label htmlFor="zoomRange">Zoom: {zoom}%</label><input id="zoomRange" type="range" min={100} max={500} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>
          <label htmlFor="brightnessRange">Brilho: {brightness}%</label><input id="brightnessRange" type="range" min={0} max={100} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />

            <div className="temp-widget">
      <h3>Temperatura do Robô</h3>
      
      <progress
      
      value={temp}
        
        max={120}
        style={{ width: "100%",height: "35%", accentColor: barColor }}>  </progress>
        <br />
        <br />
        <div style={{ fontSize: "1.5rem", textAlign: "center", marginTop: "-20px" }}>{temp?.toFixed(1)} °C</div>
      
    </div>
          
        </section>

        <section className="camera-gyro-container">
          <section className="camera-plus-thumbs">
          <div className="camera-container">
            
              {/* 1) atribua a ref aqui */}
            <div className="video-wrapper" ref={cameraContainerRef}>
              
              {/* 5) botão de fullscreen */}
              <button 
                className="fullscreen-btn" 
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Sair de tela cheia" : "Tela cheia"}
              >
                ⛶
              </button>


              
  {loadingCam && <div className="loading-placeholder">Carregando</div>}
      <img
        id="camera"
        src={streamUrl}
        key={streamUrl}   // Mantido para forçar recarregamento da imagem
        alt="Câmera"
        crossOrigin="anonymous"
        onLoad={handleImageLoad}
        onError={handleImageError} // Chama a função caso haja erro
        style={{ display: loadingCam ? 'none' : 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
      />

 <div className="overlay bottom-left" style={{fontSize: "18px"}}>Deslocamento: {encoderValue?.toFixed(2)} mm</div>
 <div className="overlay bottom-right" style={{fontSize: "19px"}}>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</div>
 </div>
</div>

<section className="captured-row">
{capturedPhotos.map((photo, i) => (
 <div key={i} className="icone">
 <button
 type="button"
 className="icone-btn"
 onClick={() => openLightbox(photo)}
 aria-label={`Abrir foto ${i + 1}`}
 >
 <img src={photo} alt={`Foto ${i + 1}`} />
 </button>
  </div>
))}
 {capturedPhotos.length<3 && Array.from({length:3-capturedPhotos.length}).map((_,i)=>(<div key={i} className="icone"><img src={`icone-${i+1}.png`} alt={`Ícone ${i+1}`}/></div>))}
 </section>

 <label htmlFor="resSelect">Resolução:</label>
<select
 className="resSelect"
 value={resolution}
 onChange={e => setResolution(e.target.value)}
>
 <option value="1080p">1080p (1920×1080)</option>
 <option value="720p">720p (1280×720)</option>
 <option value="480p">480p (640×480)</option>
 <option value="320p">320p (320×240)</option>
 <option value="180p">180p (160×120)</option>
</select>


 {/* Lightbox Modal */}
{lightboxUrl && (
 <div className="lightbox" onClick={closeLightbox}>
 <div className="lightbox-content" onClick={e => e.stopPropagation()}>
 <button className="lightbox-close" onClick={closeLightbox} aria-label="Fechar">
 x
 </button>
 <img src={lightboxUrl} alt="Foto ampliada" className="lightbox-img" />
 </div>
 </div>
)}
</section>

<div className="gyro-widget-container">
<p>Deslocamento do eixo X/Y</p>
<frc-gyro value={gyroValue}></frc-gyro>
 <br />
<p>Deslocamento do eixo Y/Z</p>
 <frc-gyro value={(roll ?? 0) - 3.30}></frc-gyro>
 <br />
 {renderBatteryStatus()}
 
   </div>
 </section>
 </main>
 
 </div>
 );
}

export default App;
