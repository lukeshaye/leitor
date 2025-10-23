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
const restartBtn = document.getElementById('restart-btn');

// --- Seletores de Modo ---
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const rsvpReaderView = document.getElementById('rsvp-reader-view');
const wordDisplay = document.getElementById('word-display');
const traditionalReaderView = document.getElementById('traditional-reader-view');
const traditionalFontSizeInput = document.getElementById('traditional-font-size-input');
const rsvpControls = document.querySelectorAll('.rsvp-controls');
const traditionalControls = document.querySelectorAll('.traditional-controls');

// --- NOVO: Seletores do Modal ---
const openTextModalBtn = document.getElementById('open-text-modal-btn');
const textModalOverlay = document.getElementById('text-modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');

// --- Estado do Aplicativo ---
let words = []; 
let currentWordIndex = 0;
let wpm = parseInt(wpmInput.value, 10);
let isReading = false;
let readInterval = null;
let currentMode = 'dynamic'; 
let traditionalScrollPos = 0; 

// --- Event Listeners ---

fileInput.addEventListener('change', handleFileLoad);
startPauseBtn.addEventListener('click', toggleReading);
themeToggleBtn.addEventListener('click', toggleTheme);
fullscreenBtn.addEventListener('click', toggleFullScreen);
restartBtn.addEventListener('click', restartReading); 
document.addEventListener('keydown', handleKeydown);
modeToggleBtn.addEventListener('click', toggleReadMode);

// --- Listeners do Modal (NOVOS) ---
openTextModalBtn.addEventListener('click', openTextModal);
modalCloseBtn.addEventListener('click', closeTextModal);
textModalOverlay.addEventListener('click', (e) => {
    // Fecha o modal apenas se clicar no fundo (overlay)
    if (e.target === textModalOverlay) {
        closeTextModal();
    }
});
// MODIFICADO: Fecha o modal após carregar o texto
loadTextBtn.addEventListener('click', () => {
    handleTextareaLoad();
    closeTextModal(); // Fecha o modal
});


// Listeners dos Inputs (salvando configurações)
wpmInput.addEventListener('change', () => {
    wpm = parseInt(wpmInput.value, 10);
    if (isReading) {
        pauseReading();
        startReading();
    }
    saveSettings(); 
});
fontSizeInput.addEventListener('input', () => {
    const size = fontSizeInput.value;
    if (size) {
        wordDisplay.style.fontSize = `${size}px`;
        saveSettings(); 
    }
});
traditionalFontSizeInput.addEventListener('input', () => {
    const size = traditionalFontSizeInput.value;
    if (size) {
        traditionalReaderView.style.fontSize = `${size}px`;
        saveSettings(); 
    }
});

// Listener de Tela Cheia
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        fullscreenBtn.textContent = 'Tela Cheia';
    }
});


// --- Funções do Modal (NOVAS) ---

function openTextModal() {
    textModalOverlay.classList.remove('hidden');
    textareaInput.focus(); // Foca no textarea ao abrir
}

function closeTextModal() {
    textModalOverlay.classList.add('hidden');
}

// --- Funções Principais ---

function toggleTheme() {
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    themeToggleBtn.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
    themeToggleBtn.classList.toggle('active-btn', isDark);
    saveSettings();
}

function toggleReadMode() {
    pauseReading(); 

    if (currentMode === 'dynamic') {
        currentMode = 'traditional';
        modeToggleBtn.textContent = 'Modo Dinâmico';
        modeToggleBtn.classList.add('active-btn'); 
        rsvpReaderView.classList.add('hidden');
        traditionalReaderView.classList.remove('hidden');
        rsvpControls.forEach(el => el.classList.add('hidden'));
        traditionalControls.forEach(el => el.classList.remove('hidden'));
        traditionalReaderView.scrollTop = traditionalScrollPos;
    } else {
        currentMode = 'dynamic';
        modeToggleBtn.textContent = 'Modo Tradicional';
        modeToggleBtn.classList.remove('active-btn'); 
        traditionalScrollPos = traditionalReaderView.scrollTop;
        traditionalReaderView.classList.add('hidden');
        rsvpReaderView.classList.remove('hidden');
        traditionalControls.forEach(el => el.classList.add('hidden'));
        rsvpControls.forEach(el => el.classList.remove('hidden'));
    }
}

function processText(text) {
    words = text.split(/\s+/).filter(word => word.length > 0);
    const htmlText = text.replace(/\n/g, '<br>');
    traditionalReaderView.innerHTML = htmlText;
    
    if (words.length > 0) {
        wordDisplay.textContent = "Pronto!";
        startPauseBtn.disabled = false;
        restartBtn.disabled = false; 
    } else {
        wordDisplay.textContent = "Nenhum texto encontrado.";
    }
}

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
        processText(text);
    } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        wordDisplay.textContent = "Erro ao ler o arquivo.";
    }
}

function handleTextareaLoad() {
    const text = textareaInput.value;
    resetReader();
    processText(text);
}

function extractTextFromTxt(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

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
                    fullText += textContent.items.map(item => item.str).join(' ');
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

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        const elementToFullscreen = document.querySelector('.reader-container'); 
        elementToFullscreen.requestFullscreen()
            .then(() => { fullscreenBtn.textContent = 'Sair (Esc)'; })
            .catch(err => { alert(`Erro ao entrar em tela cheia: ${err.message}`); });
    } else {
        document.exitFullscreen();
        fullscreenBtn.textContent = 'Tela Cheia';
    }
}

// --- Funções de Leitura ---

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
        wordDisplay.textContent = "Fim!";
        currentWordIndex = 0; 
        startPauseBtn.textContent = 'Iniciar';
        return;
    }
    wordDisplay.textContent = words[currentWordIndex];
    currentWordIndex++;
}

function restartReading() {
    pauseReading();
    currentWordIndex = 0;
    if (words.length > 0) {
        displayNextWord();
        pauseReading(); 
    }
}

function resetReader() {
    pauseReading();
    words = [];
    currentWordIndex = 0;
    traditionalScrollPos = 0; 
    startPauseBtn.disabled = true;
    restartBtn.disabled = true; 
    wordDisplay.textContent = "Carregue um arquivo ou cole um texto";
    traditionalReaderView.innerHTML = "";
    traditionalReaderView.scrollTop = 0; 
}

// --- Funções de Persistência (LocalStorage) ---

function saveSettings() {
    const settings = {
        wpm: wpmInput.value,
        dynamicFontSize: fontSizeInput.value,
        traditionalFontSize: traditionalFontSizeInput.value,
        darkMode: body.classList.contains('dark-mode')
    };
    localStorage.setItem('leitorRapidoSettings', JSON.stringify(settings));
}

function loadSettings() {
    const settingsStr = localStorage.getItem('leitorRapidoSettings');
    if (!settingsStr) return;

    const settings = JSON.parse(settingsStr);

    if (settings.wpm) {
        wpmInput.value = settings.wpm;
        wpm = parseInt(settings.wpm, 10);
    }
    if (settings.dynamicFontSize) {
        fontSizeInput.value = settings.dynamicFontSize;
        wordDisplay.style.fontSize = `${settings.dynamicFontSize}px`;
    }
    if (settings.traditionalFontSize) {
        traditionalFontSizeInput.value = settings.traditionalFontSize;
        traditionalReaderView.style.fontSize = `${settings.traditionalFontSize}px`;
    }
    if (settings.darkMode) {
        toggleTheme();
    }
}

// --- Função para Atalhos de Teclado ---

function handleKeydown(e) {
    // Se o modal estiver aberto, o único atalho é o Escape
    if (!textModalOverlay.classList.contains('hidden')) {
        if (e.code === 'Escape') {
            closeTextModal();
        }
        return; // Ignora outros atalhos
    }
    
    // Ignora atalhos se o foco estiver em inputs (não se aplica mais ao textarea, que está no modal)
    if (e.target.tagName === 'INPUT') {
        return;
    }

    switch (e.code) {
        case 'Space':
            e.preventDefault(); 
            if (!startPauseBtn.disabled && currentMode === 'dynamic') {
                toggleReading();
            }
            break;
        case 'KeyM':
            toggleReadMode();
            break;
        case 'KeyT':
            toggleTheme();
            break;
        case 'KeyF':
            toggleFullScreen();
            break;
    }
}

// --- Inicialização ---
loadSettings();