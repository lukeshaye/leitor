// --- Configuração do PDF.js ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// --- Seletores de Elementos DOM ---
const fileInput = document.getElementById('file-input');
const wpmInput = document.getElementById('wpm-input');
const startPauseBtn = document.getElementById('start-pause-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const body = document.body;
const fullscreenBtn = document.getElementById('fullscreen-btn');
const textareaInput = document.getElementById('textarea-input');
const loadTextBtn = document.getElementById('load-text-btn');
const fontSizeInput = document.getElementById('font-size-input');

// --- Seletores de Modo (NOVOS) ---
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const rsvpReaderView = document.getElementById('rsvp-reader-view');
const wordDisplay = document.getElementById('word-display');
const traditionalReaderView = document.getElementById('traditional-reader-view');
const traditionalFontSizeInput = document.getElementById('traditional-font-size-input');
const rsvpControls = document.querySelectorAll('.rsvp-controls');
const traditionalControls = document.querySelectorAll('.traditional-controls');

// --- Estado do Aplicativo ---
let words = []; 
let currentWordIndex = 0;
let wpm = parseInt(wpmInput.value, 10);
let isReading = false;
let readInterval = null;
let currentMode = 'dynamic'; // 'dynamic' ou 'traditional'

// --- Event Listeners ---

fileInput.addEventListener('change', handleFileLoad);
startPauseBtn.addEventListener('click', toggleReading);
themeToggleBtn.addEventListener('click', toggleTheme);
fullscreenBtn.addEventListener('click', toggleFullScreen);
loadTextBtn.addEventListener('click', handleTextareaLoad);

// Listener para WPM (sem alteração)
wpmInput.addEventListener('change', () => {
    wpm = parseInt(wpmInput.value, 10);
    if (isReading) {
        pauseReading();
        startReading();
    }
});

// Listener para Fonte Dinâmica (sem alteração)
fontSizeInput.addEventListener('input', () => {
    const size = fontSizeInput.value;
    if (size) {
        wordDisplay.style.fontSize = `${size}px`;
    }
});

// NOVO: Listener para Fonte Tradicional
traditionalFontSizeInput.addEventListener('input', () => {
    const size = traditionalFontSizeInput.value;
    if (size) {
        traditionalReaderView.style.fontSize = `${size}px`;
    }
});

// NOVO: Listener para Alternar Modo
modeToggleBtn.addEventListener('click', toggleReadMode);

// Listener para sair da tela cheia com 'Esc' (sem alteração)
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        fullscreenBtn.textContent = 'Tela Cheia';
    }
});


// --- Funções Principais ---

function toggleTheme() {
    body.classList.toggle('dark-mode');
    themeToggleBtn.textContent = body.classList.contains('dark-mode') ? 'Modo Claro' : 'Modo Escuro';
}

/**
 * NOVO: Alterna entre o modo de leitura dinâmico e tradicional
 */
function toggleReadMode() {
    pauseReading(); // Sempre pausa ao trocar de modo

    if (currentMode === 'dynamic') {
        // Mudar para Tradicional
        currentMode = 'traditional';
        modeToggleBtn.textContent = 'Modo Dinâmico';
        
        rsvpReaderView.classList.add('hidden');
        traditionalReaderView.classList.remove('hidden');
        
        // Esconde controles do RSVP e mostra os do Tradicional
        rsvpControls.forEach(el => el.classList.add('hidden'));
        traditionalControls.forEach(el => el.classList.remove('hidden'));

    } else {
        // Mudar para Dinâmico
        currentMode = 'dynamic';
        modeToggleBtn.textContent = 'Modo Tradicional';
        
        traditionalReaderView.classList.add('hidden');
        rsvpReaderView.classList.remove('hidden');

        // Esconde controles do Tradicional e mostra os do RSVP
        traditionalControls.forEach(el => el.classList.add('hidden'));
        rsvpControls.forEach(el => el.classList.remove('hidden'));
    }
}

/**
 * MODIFICADO: Processa o texto e carrega em AMBAS as visualizações
 */
function processText(text) {
    // 1. Para o modo Dinâmico (RSVP)
    words = text.split(/\s+/).filter(word => word.length > 0);
    
    // 2. Para o modo Tradicional
    // Substitui quebras de linha (\n) por tags <br> para manter os parágrafos
    const htmlText = text.replace(/\n/g, '<br>');
    traditionalReaderView.innerHTML = htmlText;
    
    // 3. Atualiza a UI
    if (words.length > 0) {
        wordDisplay.textContent = "Pronto!";
        startPauseBtn.disabled = false;
    } else {
        wordDisplay.textContent = "Nenhum texto encontrado.";
    }
}

/**
 * Lida com o upload do arquivo (MODIFICADO)
 */
async function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    resetReader(); 
    wordDisplay.textContent = "Carregando...";

    try {
        let text = '';
        if (file.type === 'application/pdf') {
            text = await extractTextFromPdf(file);
        } else if (file.type === 'text/plain') {
            text = await extractTextFromTxt(file);
        } else {
            throw new Error('Tipo de arquivo não suportado.');
        }
        
        processText(text); // Esta função agora carrega os dois modos

    } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        wordDisplay.textContent = "Erro ao ler o arquivo.";
    }
}

/**
 * Lida com o clique do botão "Carregar Texto" (MODIFICADO)
 */
function handleTextareaLoad() {
    const text = textareaInput.value;
    resetReader();
    processText(text); // Esta função agora carrega os dois modos
}

/**
 * Extrai texto de um arquivo .txt (sem alteração)
 */
function extractTextFromTxt(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

/**
 * Extrai texto de um arquivo .pdf usando pdf.js (sem alteração)
 */
async function extractTextFromPdf(file) {
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    // Concatena o texto de cada item e adiciona um espaço
                    fullText += textContent.items.map(item => item.str).join(' ');
                    // Adiciona uma quebra de linha no final de cada página
                    fullText += '\n\n'; 
                }
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Lógica para alternar tela cheia (MODIFICADO)
 * Agora verifica qual modo está ativo
 */
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        // Determina qual elemento está visível para colocar em tela cheia
        const elementToFullscreen = (currentMode === 'dynamic') ? rsvpReaderView : traditionalReaderView;
        
        elementToFullscreen.requestFullscreen()
            .then(() => {
                fullscreenBtn.textContent = 'Sair (Esc)';
            })
            .catch(err => {
                alert(`Erro ao entrar em tela cheia: ${err.message}`);
            });
    } else {
        document.exitFullscreen();
        fullscreenBtn.textContent = 'Tela Cheia';
    }
}

/**
 * Inicia ou pausa a leitura (sem alteração)
 */
function toggleReading() {
    if (isReading) {
        pauseReading();
    } else {
        startReading();
    }
}

function startReading() {
    if (words.length === 0 || currentMode !== 'dynamic') return;
    isReading = true;
    startPauseBtn.textContent = 'Pausar';
    const intervalTime = (60 / wpm) * 1000;
    readInterval = setInterval(displayNextWord, intervalTime);
}

function pauseReading() {
    isReading = false;
    startPauseBtn.textContent = 'Iniciar';
    clearInterval(readInterval);
}

function displayNextWord() {
    if (currentWordIndex >= words.length) {
        pauseReading();
        resetReader();
        wordDisplay.textContent = "Fim!";
        return;
    }
    wordDisplay.textContent = words[currentWordIndex];
    currentWordIndex++;
}

/**
 * Reseta o estado do leitor (MODIFICADO)
 * Agora limpa ambas as visualizações
 */
function resetReader() {
    pauseReading();
    words = [];
    currentWordIndex = 0;
    startPauseBtn.disabled = true;
    
    // Limpa ambas as visualizações
    wordDisplay.textContent = "Carregue um arquivo ou cole um texto";
    traditionalReaderView.innerHTML = ""; // Limpa o texto tradicional
}