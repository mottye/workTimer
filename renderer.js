// 複数ストップウォッチ管理
let stopwatches = [];
let nextStopwatchId = 1;
let currentRunningStopwatchId = null; // 現在動作中のストップウォッチID

// カテゴリ管理
let categories = [];
let nextCategoryId = 1;

// Slack Webhook URL を保存する変数
let slackWebhookUrl = null;
let slackWebhookEnabled = false; // Slack通知の有効/無効

const { ipcRenderer } = require('electron');

// 通知の許可をリクエスト
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Slack Webhook URLを読み込む
function loadSlackWebhookUrl() {
  const savedUrl = localStorage.getItem('slackWebhookUrl');
  if (savedUrl) {
    slackWebhookUrl = savedUrl;
    console.log('Slack Webhook URLを読み込みました:', slackWebhookUrl);
  }
  
  const savedEnabled = localStorage.getItem('slackWebhookEnabled');
  if (savedEnabled !== null) {
    slackWebhookEnabled = savedEnabled === 'true';
    console.log('Slack Webhook有効状態を読み込みました:', slackWebhookEnabled);
  }
}

// 初期化時にURLを読み込む
loadSlackWebhookUrl();

const menuBtn = document.getElementById('menuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const addCategoryMenuItem = document.getElementById('addCategoryMenuItem');
const addTimerMenuItem = document.getElementById('addTimerMenuItem');
const setSlackWebhookMenuItem = document.getElementById('setSlackWebhookMenuItem');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');
const timersContainer = document.getElementById('timersContainer');
const totalTimeDisplay = document.getElementById('totalTimeDisplay');
const targetTotalDisplay = document.getElementById('targetTotalDisplay');

// カテゴリクラス
class Category {
  constructor(id, name = '新しいカテゴリ') {
    this.id = id;
    this.name = name;
    this.isCollapsed = false; // 折りたたみ状態
  }
  
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
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
    this.targetSeconds = null; // 目標時間（秒）
    this.targetReached = false; // 目標達成フラグ
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
      
      // 目標時間達成チェック
      if (this.checkTargetReached()) {
        // 通知を表示
        const notification = new Notification('⏱️ 目標時間達成！', {
          body: `「${this.taskName || 'タスク'}」が目標時間に達しました。`,
          silent: false
        });
      }
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

  setTargetTime(hours, minutes, seconds) {
    if (hours === '' && minutes === '' && seconds === '') {
      this.targetSeconds = null;
      this.targetReached = false;
      return;
    }
    
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    this.targetSeconds = h * 3600 + m * 60 + s;
    this.targetReached = false;
  }

  checkTargetReached() {
    if (this.targetSeconds !== null && !this.targetReached && this.elapsedSeconds >= this.targetSeconds) {
      this.targetReached = true;
      return true;
    }
    return false;
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
  card.setAttribute('draggable', 'true');

  card.innerHTML = `
    <div class="task-name-container">
      <span class="drag-handle-small" title="ドラッグして移動">⋮⋮</span>
      <input type="text" class="task-name-input" placeholder="タスク名" value="">
    </div>
    <div class="target-time-container">
      <span class="target-label">目標:</span>
      <input type="number" class="target-input target-hours" placeholder="時" min="0" max="99" value="">
      <span class="target-separator">:</span>
      <input type="number" class="target-input target-minutes" placeholder="分" min="0" max="59" value="">
      <span class="target-separator">:</span>
      <input type="number" class="target-input target-seconds" placeholder="秒" min="0" max="59" value="">
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
  const targetHours = card.querySelector('.target-hours');
  const targetMinutes = card.querySelector('.target-minutes');
  const targetSeconds = card.querySelector('.target-seconds');
  const startBtn = card.querySelector('.start-btn');
  const pauseBtn = card.querySelector('.pause-btn');
  const clearBtn = card.querySelector('.clear-btn');
  const timerDisplay = card.querySelector('.timer-display');

  // 削除ボタンイベント
  deleteBtn.addEventListener('click', () => {
    removeStopwatch(stopwatch.id);
  });

  // タスク名の変更
  taskNameInput.addEventListener('input', (e) => {
    stopwatch.setTaskName(e.target.value);
  });

  // 目標時間の入力イベント
  const updateTargetTime = () => {
    stopwatch.setTargetTime(targetHours.value, targetMinutes.value, targetSeconds.value);
    updateTimerDisplay();
    updateTargetTotalTime();
    updateCategoryTime(stopwatch.categoryId);
  };
  
  targetHours.addEventListener('input', updateTargetTime);
  targetMinutes.addEventListener('input', updateTargetTime);
  targetSeconds.addEventListener('input', updateTargetTime);

  // タイマー表示の更新（目標時間との比較も含む）
  const updateTimerDisplay = () => {
    timerDisplay.textContent = stopwatch.formatTime(stopwatch.elapsedSeconds);
    
    // 目標時間が設定されている場合の処理
    if (stopwatch.targetSeconds !== null) {
      if (stopwatch.elapsedSeconds >= stopwatch.targetSeconds) {
        card.classList.add('target-reached');
      } else {
        card.classList.remove('target-reached');
      }
    } else {
      card.classList.remove('target-reached');
    }
  };
  
  // 初回表示更新
  updateTimerDisplay();

  // ボタンイベント
  startBtn.addEventListener('click', () => stopwatch.start());
  pauseBtn.addEventListener('click', () => stopwatch.pause());
  clearBtn.addEventListener('click', () => stopwatch.clear());

  // ドラッグ&ドロップイベント（タイマーカード）
  card.addEventListener('dragstart', handleTimerDragStart);
  card.addEventListener('dragover', handleTimerDragOver);
  card.addEventListener('drop', handleTimerDrop);
  card.addEventListener('dragend', handleDragEnd);

  return card;
}

// ストップウォッチを削除
function removeStopwatch(stopwatchId) {
  const stopwatch = stopwatches.find(t => t.id === stopwatchId);
  if (!stopwatch) return;

  // 確認ダイアログを表示
  const taskName = stopwatch.taskName || 'タスク名なし';
  const confirmMessage = `「${taskName}」を削除してもよろしいですか？`;
  if (!confirm(confirmMessage)) {
    return; // キャンセルされた場合は削除しない
  }

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
  updateTargetTotalTime();
  updateAllCategoryTimes();
}

// 目標時間の合計を更新
function updateTargetTotalTime() {
  const targetTotalSeconds = stopwatches.reduce((sum, sw) => {
    return sum + (sw.targetSeconds || 0);
  }, 0);
  
  if (targetTotalDisplay) {
    if (targetTotalSeconds > 0) {
      targetTotalDisplay.textContent = formatTime(targetTotalSeconds);
    } else {
      targetTotalDisplay.textContent = '--:--:--';
    }
  }
}

// 全カテゴリの時間を更新
function updateAllCategoryTimes() {
  categories.forEach(category => {
    updateCategoryTime(category.id);
  });
}

// カテゴリごとの時間を更新
function updateCategoryTime(categoryId) {
  const categoryContainer = document.querySelector(`.category-container[data-category-id="${categoryId}"]`);
  if (!categoryContainer) return;
  
  const elapsedTimeElement = categoryContainer.querySelector('.category-elapsed-time');
  const targetTimeElement = categoryContainer.querySelector('.category-target-time');
  
  // そのカテゴリに属するストップウォッチを取得
  const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
  
  // 経過時間の合計
  const elapsedTotal = categoryStopwatches.reduce((sum, sw) => sum + sw.elapsedSeconds, 0);
  
  // 目標時間の合計
  const targetTotal = categoryStopwatches.reduce((sum, sw) => sum + (sw.targetSeconds || 0), 0);
  
  // 表示を更新
  if (elapsedTimeElement) {
    elapsedTimeElement.textContent = formatTime(elapsedTotal);
  }
  
  if (targetTimeElement) {
    if (targetTotal > 0) {
      targetTimeElement.textContent = `/ ${formatTime(targetTotal)}`;
    } else {
      targetTimeElement.textContent = '/ --:--:--';
    }
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
  container.setAttribute('draggable', 'true');

  container.innerHTML = `
    <div class="category-header">
      <button class="collapse-btn" title="折りたたみ">
        <span class="material-icons collapse-icon">expand_more</span>
      </button>
      <span class="drag-handle" title="ドラッグして移動">⋮⋮</span>
      <div class="category-info">
        <input type="text" class="category-name-input" value="${category.name}" placeholder="カテゴリ名">
        <div class="category-time-summary">
          <span class="category-elapsed-time">00:00:00</span>
          <span class="category-target-time">/ --:--:--</span>
        </div>
      </div>
      <div class="category-controls">
        <button class="category-menu-btn" title="メニュー">
          <span class="material-icons">more_vert</span>
        </button>
        <div class="category-dropdown-menu hidden">
          <div class="menu-item category-add-timer-item">
            <span class="material-icons">add_circle_outline</span>
            <span>タイマーを追加</span>
          </div>
          <div class="menu-item category-delete-item">
            <span class="material-icons">delete</span>
            <span>カテゴリを削除</span>
          </div>
        </div>
      </div>
    </div>
    <div class="category-timers" data-category-id="${category.id}">
      <div class="category-empty-state">「メニューからタイマーを追加」</div>
    </div>
  `;

  // イベントリスナー
  const collapseBtn = container.querySelector('.collapse-btn');
  const collapseIcon = container.querySelector('.collapse-icon');
  const categoryTimers = container.querySelector('.category-timers');
  const nameInput = container.querySelector('.category-name-input');
  const categoryMenuBtn = container.querySelector('.category-menu-btn');
  const categoryDropdownMenu = container.querySelector('.category-dropdown-menu');
  const categoryAddTimerItem = container.querySelector('.category-add-timer-item');
  const categoryDeleteItem = container.querySelector('.category-delete-item');

  // 折りたたみボタン
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    category.toggleCollapse();
    
    if (category.isCollapsed) {
      categoryTimers.classList.add('collapsed');
      collapseIcon.textContent = 'chevron_right';
      container.classList.add('collapsed');
    } else {
      categoryTimers.classList.remove('collapsed');
      collapseIcon.textContent = 'expand_more';
      container.classList.remove('collapsed');
    }
  });

  nameInput.addEventListener('input', (e) => {
    category.name = e.target.value;
  });

  // カテゴリメニューの開閉
  categoryMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 他のカテゴリメニューを閉じる
    document.querySelectorAll('.category-dropdown-menu').forEach(menu => {
      if (menu !== categoryDropdownMenu) {
        menu.classList.add('hidden');
      }
    });
    categoryDropdownMenu.classList.toggle('hidden');
  });

  // メニュー項目のクリック
  categoryAddTimerItem.addEventListener('click', (e) => {
    e.stopPropagation();
    addStopwatch(category.id);
    categoryDropdownMenu.classList.add('hidden');
  });

  categoryDeleteItem.addEventListener('click', (e) => {
    e.stopPropagation();
    removeCategory(category.id);
    categoryDropdownMenu.classList.add('hidden');
  });

  // ドラッグ&ドロップイベント（カテゴリ）
  container.addEventListener('dragstart', handleCategoryDragStart);
  container.addEventListener('dragover', handleCategoryDragOver);
  container.addEventListener('drop', handleCategoryDrop);
  container.addEventListener('dragend', handleDragEnd);

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
  // 確認ダイアログを表示
  const category = categories.find(c => c.id === categoryId);
  const categoryName = category ? category.name : 'カテゴリ';
  const categoryStopwatches = stopwatches.filter(sw => sw.categoryId === categoryId);
  const timerCount = categoryStopwatches.length;
  
  let confirmMessage = `「${categoryName}」を削除してもよろしいですか？`;
  if (timerCount > 0) {
    confirmMessage += `\n（カテゴリ内の${timerCount}個のタイマーも削除されます）`;
  }
  
  if (!confirm(confirmMessage)) {
    return; // キャンセルされた場合は削除しない
  }

  // カテゴリ内のストップウォッチをすべて削除
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

// ドラッグ&ドロップ関連の変数
let draggedElement = null;
let draggedType = null; // 'category' or 'timer'

// カテゴリのドラッグ開始
function handleCategoryDragStart(e) {
  draggedElement = e.currentTarget;
  draggedType = 'category';
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

// カテゴリのドラッグオーバー
function handleCategoryDragOver(e) {
  if (draggedType !== 'category') return;
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.currentTarget;
  if (target !== draggedElement && target.classList.contains('category-container')) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      target.style.borderTop = '3px solid #667eea';
      target.style.borderBottom = '';
    } else {
      target.style.borderBottom = '3px solid #667eea';
      target.style.borderTop = '';
    }
  }
  
  return false;
}

// カテゴリのドロップ
function handleCategoryDrop(e) {
  if (draggedType !== 'category') return;
  if (e.stopPropagation) e.stopPropagation();
  
  const target = e.currentTarget;
  if (draggedElement !== target) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      timersContainer.insertBefore(draggedElement, target);
    } else {
      timersContainer.insertBefore(draggedElement, target.nextSibling);
    }
    
    // カテゴリ配列の順序も更新
    reorderCategoriesArray();
  }
  
  return false;
}

// タイマーのドラッグ開始
function handleTimerDragStart(e) {
  draggedElement = e.currentTarget;
  draggedType = 'timer';
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

// タイマーのドラッグオーバー
function handleTimerDragOver(e) {
  if (draggedType !== 'timer') return;
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.currentTarget;
  if (target !== draggedElement && target.classList.contains('timer-card')) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      target.style.borderTop = '3px solid #667eea';
      target.style.borderBottom = '';
    } else {
      target.style.borderBottom = '3px solid #667eea';
      target.style.borderTop = '';
    }
  }
  
  return false;
}

// タイマーのドロップ
function handleTimerDrop(e) {
  if (draggedType !== 'timer') return;
  if (e.stopPropagation) e.stopPropagation();
  
  const target = e.currentTarget;
  if (draggedElement !== target) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const targetParent = target.parentElement;
    
    if (e.clientY < midpoint) {
      targetParent.insertBefore(draggedElement, target);
    } else {
      targetParent.insertBefore(draggedElement, target.nextSibling);
    }
    
    // タイマーのカテゴリIDを更新
    const newCategoryId = targetParent.getAttribute('data-category-id');
    const timerId = parseInt(draggedElement.getAttribute('data-timer-id'));
    const timer = stopwatches.find(sw => sw.id === timerId);
    if (timer) {
      timer.categoryId = newCategoryId ? parseInt(newCategoryId) : null;
    }
  }
  
  return false;
}

// カテゴリタイマーエリアへのドロップ対応
document.addEventListener('DOMContentLoaded', () => {
  timersContainer.addEventListener('dragover', (e) => {
    if (draggedType === 'timer') {
      const categoryTimers = e.target.closest('.category-timers');
      if (categoryTimers) {
        e.preventDefault();
        categoryTimers.style.background = 'rgba(102, 126, 234, 0.1)';
      }
    }
  });
  
  timersContainer.addEventListener('drop', (e) => {
    const categoryTimers = e.target.closest('.category-timers');
    if (categoryTimers && draggedType === 'timer') {
      e.preventDefault();
      e.stopPropagation();
      
      // 空の状態メッセージを削除
      const emptyState = categoryTimers.querySelector('.category-empty-state');
      if (emptyState) {
        emptyState.remove();
      }
      
      // タイマーを追加
      categoryTimers.appendChild(draggedElement);
      
      // タイマーのカテゴリIDを更新
      const newCategoryId = categoryTimers.getAttribute('data-category-id');
      const timerId = parseInt(draggedElement.getAttribute('data-timer-id'));
      const timer = stopwatches.find(sw => sw.id === timerId);
      if (timer) {
        timer.categoryId = newCategoryId ? parseInt(newCategoryId) : null;
      }
      
      categoryTimers.style.background = '';
    }
  });
});

// ドラッグ終了
function handleDragEnd(e) {
  e.currentTarget.style.opacity = '';
  
  // すべてのボーダーをクリア
  document.querySelectorAll('.category-container, .timer-card').forEach(el => {
    el.style.borderTop = '';
    el.style.borderBottom = '';
  });
  
  document.querySelectorAll('.category-timers').forEach(el => {
    el.style.background = '';
  });
  
  draggedElement = null;
  draggedType = null;
}

// カテゴリ配列の順序を更新
function reorderCategoriesArray() {
  const categoryElements = Array.from(document.querySelectorAll('.category-container'));
  const newOrder = categoryElements.map(el => {
    const id = parseInt(el.getAttribute('data-category-id'));
    return categories.find(c => c.id === id);
  }).filter(c => c);
  
  categories.length = 0;
  categories.push(...newOrder);
}

// メニューの開閉
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('hidden');
});

// メニュー外をクリックしたら閉じる
document.addEventListener('click', (e) => {
  // ヘッダーメニューを閉じる
  if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
    dropdownMenu.classList.add('hidden');
  }
  
  // カテゴリメニューをすべて閉じる
  const categoryMenus = document.querySelectorAll('.category-dropdown-menu');
  categoryMenus.forEach(menu => {
    const menuBtn = menu.parentElement.querySelector('.category-menu-btn');
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
});

// メニュー項目のクリックイベント
addCategoryMenuItem.addEventListener('click', () => {
  addCategory();
  dropdownMenu.classList.add('hidden');
});

addTimerMenuItem.addEventListener('click', () => {
  addStopwatch(null);
  dropdownMenu.classList.add('hidden');
});

// Slack Webhook URL設定ダイアログ
const slackWebhookDialog = document.getElementById('slackWebhookDialog');
const slackWebhookInput = document.getElementById('slackWebhookInput');
const slackWebhookEnabledCheckbox = document.getElementById('slackWebhookEnabled');
const slackWebhookSave = document.getElementById('slackWebhookSave');
const slackWebhookCancel = document.getElementById('slackWebhookCancel');

// ダイアログを開く
function openSlackWebhookDialog() {
  slackWebhookInput.value = slackWebhookUrl || '';
  slackWebhookEnabledCheckbox.checked = slackWebhookEnabled;
  slackWebhookDialog.classList.remove('hidden');
  slackWebhookInput.focus();
  dropdownMenu.classList.add('hidden');
}

// ダイアログを閉じる
function closeSlackWebhookDialog() {
  slackWebhookDialog.classList.add('hidden');
  slackWebhookInput.value = '';
}

// Slack Webhook URL設定メニュー
if (setSlackWebhookMenuItem) {
  setSlackWebhookMenuItem.addEventListener('click', () => {
    openSlackWebhookDialog();
  });
}

// 保存ボタン
slackWebhookSave.addEventListener('click', () => {
  const newUrl = slackWebhookInput.value.trim();
  const isEnabled = slackWebhookEnabledCheckbox.checked;
  
  if (newUrl === '') {
    // 空文字の場合は削除
    slackWebhookUrl = null;
    localStorage.removeItem('slackWebhookUrl');
    console.log('Slack Webhook URLを削除しました');
  } else {
    // URLを保存
    slackWebhookUrl = newUrl;
    localStorage.setItem('slackWebhookUrl', slackWebhookUrl);
    console.log('Slack Webhook URLを保存しました:', slackWebhookUrl);
  }
  
  // 有効/無効の状態を保存
  slackWebhookEnabled = isEnabled;
  localStorage.setItem('slackWebhookEnabled', slackWebhookEnabled.toString());
  console.log('Slack Webhook有効状態を保存しました:', slackWebhookEnabled);
  
  closeSlackWebhookDialog();
});

// キャンセルボタン
slackWebhookCancel.addEventListener('click', () => {
  closeSlackWebhookDialog();
});

// オーバーレイクリックで閉じる
slackWebhookDialog.addEventListener('click', (e) => {
  if (e.target === slackWebhookDialog) {
    closeSlackWebhookDialog();
  }
});

// Enterキーで保存
slackWebhookInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    slackWebhookSave.click();
  }
});

// 透明度スライダーのイベント
opacitySlider.addEventListener('input', (e) => {
  const opacityPercent = parseInt(e.target.value);
  const opacity = opacityPercent / 100;
  
  // 透明度の値を表示
  opacityValue.textContent = `${opacityPercent}%`;
  
  // メインプロセスに透明度変更を通知
  ipcRenderer.send('set-opacity', opacity);
});

// スライダー上でクリックしてもメニューが閉じないようにする
opacitySlider.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.querySelector('.menu-item-slider').addEventListener('click', (e) => {
  e.stopPropagation();
});

