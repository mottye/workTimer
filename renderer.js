// 複数ストップウォッチ管理
let stopwatches = [];
let nextStopwatchId = 1;
let currentRunningStopwatchId = null; // 現在動作中のストップウォッチID

const addTimerBtn = document.getElementById('addTimerBtn');
const timersContainer = document.getElementById('timersContainer');
const totalTimeDisplay = document.getElementById('totalTimeDisplay');

// ストップウォッチクラス
class Stopwatch {
  constructor(id) {
    this.id = id;
    this.elapsedSeconds = 0; // 経過時間（秒）
    this.interval = null;
    this.isRunning = false;
    this.isPaused = false;
    this.taskName = ''; // タスク名
  }

  start() {
    // 他のストップウォッチが動作中なら停止させる
    if (currentRunningStopwatchId !== null && currentRunningStopwatchId !== this.id) {
      const runningStopwatch = stopwatches.find(sw => sw.id === currentRunningStopwatchId);
      if (runningStopwatch) {
        runningStopwatch.pause();
      }
    }

    if (!this.isRunning) {
      // 新規開始
      this.isRunning = true;
      this.isPaused = false;
    } else if (this.isPaused) {
      // 再開
      this.isPaused = false;
    }

    // このストップウォッチを動作中として記録
    currentRunningStopwatchId = this.id;

    this.interval = setInterval(() => {
      this.elapsedSeconds++;
      this.updateDisplay();
    }, 1000);

    this.updateButtons();
  }

  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isPaused = true;
      
      // このストップウォッチが動作中だった場合、動作中IDをクリア
      if (currentRunningStopwatchId === this.id) {
        currentRunningStopwatchId = null;
      }
      
      this.updateButtons();
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    
    // このストップウォッチが動作中だった場合、動作中IDをクリア
    if (currentRunningStopwatchId === this.id) {
      currentRunningStopwatchId = null;
    }
  }

  clear() {
    this.stop();
    this.elapsedSeconds = 0;
    this.updateDisplay();
    this.updateButtons();
  }

  updateDisplay() {
    const element = document.querySelector(`[data-timer-id="${this.id}"] .timer-display`);
    if (element) {
      element.textContent = this.formatTime(this.elapsedSeconds);
    }
    // 合計時間も更新
    updateTotalTime();
  }

  updateButtons() {
    const card = document.querySelector(`[data-timer-id="${this.id}"]`);
    if (!card) return;

    const startBtn = card.querySelector('.start-btn');
    const pauseBtn = card.querySelector('.pause-btn');

    if (this.isRunning && !this.isPaused) {
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      card.classList.add('running'); // ハイライト表示
    } else if (this.isPaused) {
      startBtn.disabled = false;
      startBtn.title = '再開';
      pauseBtn.disabled = true;
      card.classList.remove('running'); // ハイライト解除
    } else {
      startBtn.disabled = false;
      startBtn.title = 'スタート';
      pauseBtn.disabled = true;
      card.classList.remove('running'); // ハイライト解除
    }
  }

  formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  setTaskName(name) {
    this.taskName = name;
  }
}

// ストップウォッチを追加
function addStopwatch() {
  const stopwatch = new Stopwatch(nextStopwatchId++);
  stopwatches.push(stopwatch);

  // 空の状態を削除
  const emptyState = timersContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // ストップウォッチカードを作成
  const card = createStopwatchCard(stopwatch);
  timersContainer.appendChild(card);
}

// ストップウォッチカードのHTML作成
function createStopwatchCard(stopwatch) {
  const card = document.createElement('div');
  card.className = 'timer-card';
  card.setAttribute('data-timer-id', stopwatch.id);

  card.innerHTML = `
    <div class="task-name-container">
      <input type="text" class="task-name-input" placeholder="タスク名" value="">
    </div>
    <div class="timer-main-row">
      <div class="timer-display">${stopwatch.formatTime(stopwatch.elapsedSeconds)}</div>
      <div class="timer-controls">
        <button class="start-btn" title="スタート"><span class="material-icons">play_arrow</span></button>
        <button class="pause-btn" title="一時停止" disabled><span class="material-icons">pause</span></button>
        <button class="clear-btn" title="クリア"><span class="material-icons">refresh</span></button>
        <button class="delete-btn" title="削除"><span class="material-icons">delete</span></button>
      </div>
    </div>
  `;

  // イベントリスナーを追加
  const deleteBtn = card.querySelector('.delete-btn');
  const taskNameInput = card.querySelector('.task-name-input');
  const startBtn = card.querySelector('.start-btn');
  const pauseBtn = card.querySelector('.pause-btn');
  const clearBtn = card.querySelector('.clear-btn');

  // 削除ボタンイベント
  deleteBtn.addEventListener('click', () => {
    removeStopwatch(stopwatch.id);
  });

  // タスク名の変更
  taskNameInput.addEventListener('input', (e) => {
    stopwatch.setTaskName(e.target.value);
  });

  // ボタンイベント
  startBtn.addEventListener('click', () => stopwatch.start());
  pauseBtn.addEventListener('click', () => stopwatch.pause());
  clearBtn.addEventListener('click', () => stopwatch.clear());

  return card;
}

// ストップウォッチを削除
function removeStopwatch(stopwatchId) {
  const index = stopwatches.findIndex(t => t.id === stopwatchId);
  if (index !== -1) {
    stopwatches[index].stop();
    stopwatches.splice(index, 1);
  }

  const card = document.querySelector(`[data-timer-id="${stopwatchId}"]`);
  if (card) {
    card.remove();
  }

  // ストップウォッチがなくなったら空の状態を表示
  if (stopwatches.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = '「+ 追加」をクリック';
    timersContainer.appendChild(emptyState);
  }
}

// 合計時間を更新
function updateTotalTime() {
  const totalSeconds = stopwatches.reduce((sum, sw) => sum + sw.elapsedSeconds, 0);
  if (totalTimeDisplay) {
    totalTimeDisplay.textContent = formatTime(totalSeconds);
  }
}

// 時間フォーマット（グローバル関数）
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// イベントリスナー
addTimerBtn.addEventListener('click', addStopwatch);

// 初期状態で1つストップウォッチを追加
addStopwatch();

