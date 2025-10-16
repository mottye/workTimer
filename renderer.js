// 複数ストップウォッチ管理
let stopwatches = [];
let nextStopwatchId = 1;
let currentRunningStopwatchId = null; // 現在動作中のストップウォッチID

// カテゴリ管理
let categories = [];
let nextCategoryId = 1;

const addTimerBtn = document.getElementById('addTimerBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const timersContainer = document.getElementById('timersContainer');
const totalTimeDisplay = document.getElementById('totalTimeDisplay');

// カテゴリクラス
class Category {
  constructor(id, name = '新しいカテゴリ') {
    this.id = id;
    this.name = name;
  }
}

// ストップウォッチクラス
class Stopwatch {
  constructor(id, categoryId = null) {
    this.id = id;
    this.categoryId = categoryId; // 所属カテゴリID
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
function addStopwatch(categoryId = null) {
  const stopwatch = new Stopwatch(nextStopwatchId++, categoryId);
  stopwatches.push(stopwatch);

  // ストップウォッチカードを作成
  const card = createStopwatchCard(stopwatch);

  if (categoryId) {
    // カテゴリ内に追加
    const categoryTimers = document.querySelector(`.category-timers[data-category-id="${categoryId}"]`);
    if (categoryTimers) {
      // 空の状態メッセージを削除
      const emptyState = categoryTimers.querySelector('.category-empty-state');
      if (emptyState) {
        emptyState.remove();
      }
      categoryTimers.appendChild(card);
    }
  } else {
    // 通常のコンテナに追加（カテゴリなし）
    const emptyState = timersContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    timersContainer.appendChild(card);
  }
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
  const stopwatch = stopwatches.find(t => t.id === stopwatchId);
  if (!stopwatch) return;

  const categoryId = stopwatch.categoryId;
  
  const index = stopwatches.findIndex(t => t.id === stopwatchId);
  if (index !== -1) {
    stopwatches[index].stop(); // 削除前にストップウォッチを停止
    stopwatches.splice(index, 1);
  }

  const card = document.querySelector(`[data-timer-id="${stopwatchId}"]`);
  if (card) {
    card.remove();
  }

  // カテゴリ内が空になったら空の状態を表示
  if (categoryId) {
    const categoryTimers = document.querySelector(`.category-timers[data-category-id="${categoryId}"]`);
    const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
    if (categoryTimers && categoryStopwatches.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'category-empty-state';
      emptyState.textContent = '「+」でタイマーを追加';
      categoryTimers.appendChild(emptyState);
    }
  } else {
    // カテゴリ外のストップウォッチがすべてなくなり、カテゴリもない場合
    const categorylessStopwatches = stopwatches.filter(sw => !sw.categoryId);
    if (categorylessStopwatches.length === 0 && categories.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = '「カテゴリを追加」からスタート';
      timersContainer.appendChild(emptyState);
    }
  }
  
  updateTotalTime();
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

// カテゴリを作成
function createCategoryContainer(category) {
  const container = document.createElement('div');
  container.className = 'category-container';
  container.setAttribute('data-category-id', category.id);

  container.innerHTML = `
    <div class="category-header">
      <input type="text" class="category-name-input" value="${category.name}" placeholder="カテゴリ名">
      <div class="category-controls">
        <button class="category-add-timer-btn" title="タイマーを追加">+</button>
        <button class="category-delete-btn" title="カテゴリを削除"><span class="material-icons" style="font-size: 14px;">delete</span></button>
      </div>
    </div>
    <div class="category-timers" data-category-id="${category.id}">
      <div class="category-empty-state">「+」でタイマーを追加</div>
    </div>
  `;

  // イベントリスナー
  const nameInput = container.querySelector('.category-name-input');
  const addTimerBtn = container.querySelector('.category-add-timer-btn');
  const deleteBtn = container.querySelector('.category-delete-btn');

  nameInput.addEventListener('input', (e) => {
    category.name = e.target.value;
  });

  addTimerBtn.addEventListener('click', () => {
    addStopwatch(category.id);
  });

  deleteBtn.addEventListener('click', () => {
    removeCategory(category.id);
  });

  return container;
}

// カテゴリを追加
function addCategory() {
  const category = new Category(nextCategoryId++);
  categories.push(category);

  // 空の状態メッセージを削除
  const emptyState = timersContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const categoryContainer = createCategoryContainer(category);
  timersContainer.appendChild(categoryContainer);
}

// カテゴリを削除
function removeCategory(categoryId) {
  // カテゴリ内のストップウォッチをすべて削除
  const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
  categoryStopwatches.forEach(sw => {
    sw.stop();
  });
  stopwatches = stopwatches.filter(sw => sw.categoryId !== categoryId);

  // カテゴリを配列から削除
  const index = categories.findIndex(c => c.id === categoryId);
  if (index !== -1) {
    categories.splice(index, 1);
  }

  // DOM から削除
  const container = document.querySelector(`[data-category-id="${categoryId}"]`);
  if (container) {
    container.remove();
  }

  // カテゴリがなくなったら空の状態を表示
  if (categories.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = '「カテゴリを追加」からスタート';
    timersContainer.appendChild(emptyState);
  }

  updateTotalTime();
}

// イベントリスナー
addCategoryBtn.addEventListener('click', addCategory);
addTimerBtn.addEventListener('click', () => addStopwatch(null));

