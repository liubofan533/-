// main.js
// 入口文件，初始化页面，定义全局UI函数

// ==================== 全局变量 ====================
let chatMessages = [];
let aiMemory = {
    userName: null,
    summaries: []
};

// ==================== 初始化 ====================
window.onload = function() {
    checkOfflineStatus();
    syncCurrentDate();
    calculateAll();
    loadHistory();
    loadLatestRecord();
    // 默认显示明细组
    switchSection('detail');
    // 加载AI聊天历史
    loadChatHistory();
    // 加载AI长期记忆
    loadAIMemory();

    // 金额输入框“点击清空，失焦复原”
    document.addEventListener('focus', function(e) {
        const target = e.target;
        if (target.matches('.account-input, .reimbursement-input, .claim-input, .fixed-input, #total-claim-input')) {
            target.dataset.oldValue = target.value;
            target.value = '';
        }
    }, true);

    document.addEventListener('blur', function(e) {
        const target = e.target;
        if (target.matches('.account-input, .reimbursement-input, .claim-input, .fixed-input, #total-claim-input')) {
            const newVal = target.value.trim();
            if (newVal === '' || isNaN(parseFloat(newVal))) {
                target.value = target.dataset.oldValue || '0.00';
            }
            delete target.dataset.oldValue;
            calculateAll();
        }
    }, true);
};

// ==================== 工具函数 ====================
function showToast(message, type = 'default') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    if (type === 'success') toast.classList.add('toast-success');
    else if (type === 'error') toast.classList.add('toast-error');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== 网络状态 ====================
function checkOfflineStatus() {
    const statusElement = document.getElementById('status-bar');
    if (navigator.onLine) {
        statusElement.innerHTML = "✅ 当前网络正常，此网页支持完全离线使用";
        statusElement.style.backgroundColor = "rgba(52, 199, 89, 0.1)";
        statusElement.style.color = "var(--success)";
    } else {
        statusElement.innerHTML = "✅ 已离线，网页运行正常，数据保存在本地";
        statusElement.style.backgroundColor = "var(--primary-light)";
        statusElement.style.color = "var(--primary)";
    }
}

// ==================== 日期同步 ====================
function syncCurrentDate() {
    try {
        const today = new Date();
        const currentDay = today.getDate();
        document.getElementById('current-date').value = currentDay;
        calculateAll();
        showToast(`已同步今日日期：${currentDay}号`, 'success');
    } catch (error) {
        console.error('同步日期失败:', error);
        showToast('同步日期失败，请手动输入', 'error');
    }
}

// ==================== 标签页切换 ====================
function switchTab(tabName) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) targetTab.classList.add('active');

    const activeBtn = Array.from(tabBtns).find(btn => btn.dataset.tab === tabName);
    if (activeBtn) activeBtn.classList.add('active');

    const section = activeBtn ? activeBtn.dataset.section : 'detail';
    updateBottomNav(section);
}

function updateBottomNav(section) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if (section === 'detail') {
        navItems[0].classList.add('active');
    } else if (section === 'mumu') {
        navItems[1].classList.add('active');
    } else if (section === 'history') {
        navItems[3].classList.add('active');
    }
}

function switchSection(section) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.dataset.section === section) {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    });

    const firstBtn = Array.from(tabBtns).find(btn => btn.dataset.section === section);
    if (firstBtn) {
        const tabName = firstBtn.dataset.tab;
        switchTab(tabName);
    }

    updateBottomNav(section);
}

// ==================== 行操作 ====================
function addRow(type) {
    let containerId = '';
    let inputClass = '';
    let insertTarget = null;

    switch (type) {
        case 'reimbursement':
            containerId = 'reimbursement-container';
            inputClass = 'reimbursement-input';
            switchTab('reimbursement');
            break;
        case 'claim':
            containerId = 'claim-container';
            inputClass = 'claim-input';
            insertTarget = document.getElementById('claim-items-list');
            switchTab('claim');
            break;
        case 'fixed':
            containerId = 'fixed-container';
            inputClass = 'fixed-input';
            switchTab('fixed');
            break;
        default: return;
    }

    const newRow = document.createElement('div');
    newRow.className = 'item-row';
    const id = DataManager.generateId(); // 使用DataManager的生成ID
    newRow.dataset.id = id;
    // 根据类型决定是否添加核销按钮
    let extraButton = '';
    if (type === 'reimbursement') {
        extraButton = `<button class="item-reimburse" onclick="reimburseItem(this)">核销</button>`;
    }
    newRow.innerHTML = `
        <input type="text" class="item-name" placeholder="项目名称" oninput="calculateAll()">
        <input type="number" class="item-amount ${inputClass}" value="0.00" step="0.01" placeholder="金额" oninput="calculateAll()">
        ${extraButton}
        <button class="item-delete" onclick="deleteRow(this)">×</button>
    `;

    if (insertTarget) {
        insertTarget.appendChild(newRow);
    } else {
        const container = document.getElementById(containerId);
        const totalRow = container.querySelector('.total-row');
        container.insertBefore(newRow, totalRow);
    }

    calculateAll();
    showToast('已添加新项', 'success');
}

function deleteRow(btn) {
    const row = btn.parentElement;
    const parent = row.parentElement;
    const rows = parent.querySelectorAll('.item-row');
    if (rows.length <= 1) {
        showToast('至少保留一项', 'error');
        return;
    }
    row.remove();
    calculateAll();
    showToast('已删除该项', 'success');
}

// ==================== 计算函数 ====================
function calculateAll() {
    const safeParse = (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    };

    const accountInputs = document.querySelectorAll('.account-input');
    let totalAccounts = 0;
    accountInputs.forEach(input => {
        totalAccounts += safeParse(input.value);
        if (input.value === '' || isNaN(input.value)) input.value = '0.00';
    });
    document.getElementById('total-accounts').textContent = `${totalAccounts.toFixed(2)} 元`;

    const reimbursementInputs = document.querySelectorAll('.reimbursement-input');
    let totalReimbursement = 0;
    reimbursementInputs.forEach(input => {
        totalReimbursement += safeParse(input.value);
        if (input.value === '' || isNaN(input.value)) input.value = '0.00';
    });
    document.getElementById('total-reimbursement').textContent = `${totalReimbursement.toFixed(2)} 元`;

    const totalClaim = safeParse(document.getElementById('total-claim-input').value);
    const claimInputs = document.querySelectorAll('.claim-input');
    let totalClaimItems = 0;
    claimInputs.forEach(input => {
        totalClaimItems += safeParse(input.value);
        if (input.value === '' || isNaN(input.value)) input.value = '0.00';
    });
    const remainClaim = totalClaim - totalClaimItems;
    document.getElementById('total-claim-items').textContent = `${totalClaimItems.toFixed(2)} 元`;
    document.getElementById('remain-claim-amount').textContent = `${remainClaim.toFixed(2)} 元`;

    const fixedInputs = document.querySelectorAll('.fixed-input');
    let totalFixed = 0;
    fixedInputs.forEach(input => {
        totalFixed += safeParse(input.value);
        if (input.value === '' || isNaN(input.value)) input.value = '0.00';
    });
    document.getElementById('total-fixed').textContent = `${totalFixed.toFixed(2)} 元`;

    const personalAmount = totalAccounts - totalFixed - remainClaim;
    document.getElementById('personal-amount').textContent = `${personalAmount.toFixed(2)} 元`;

    const accountTotalAmount = totalAccounts - totalReimbursement - totalClaimItems;
    document.getElementById('disposable-balance').textContent = `${accountTotalAmount.toFixed(2)} 元`;

    const currentDate = parseInt(document.getElementById('current-date').value) || new Date().getDate();
    const salaryDay = parseInt(document.getElementById('salary-day').value) || 22;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let remainingDays;

    if (currentDate < salaryDay) {
        remainingDays = salaryDay - currentDate;
    } else {
        const nextMonthDays = new Date(currentYear, currentMonth + 2, 0).getDate();
        remainingDays = (daysInMonth - currentDate) + Math.min(salaryDay, nextMonthDays);
    }

    remainingDays = Math.max(1, remainingDays);
    document.getElementById('remaining-days').textContent = `${remainingDays} 天`;

    const dailyAllocation = remainingDays > 0 ? personalAmount / remainingDays : 0;
    document.getElementById('daily-allocation').textContent = `${dailyAllocation.toFixed(2)} 元/天`;
}

// ==================== 核销报销 ====================
function reimburseItem(btn) {
    const row = btn.closest('.item-row');
    const amountInput = row.querySelector('.reimbursement-input');
    const amount = parseFloat(amountInput.value) || 0;
    if (amount <= 0) {
        showToast('金额必须大于0', 'error');
        return;
    }

    // 查找微信余额输入框
    const accountItems = document.querySelectorAll('.data-item');
    let wechatInput = null;
    for (let item of accountItems) {
        const label = item.querySelector('.data-label');
        if (label && label.textContent.includes('微信余额')) {
            wechatInput = item.querySelector('.account-input');
            break;
        }
    }
    if (!wechatInput) {
        showToast('未找到微信余额输入框', 'error');
        return;
    }

    // 增加微信余额
    let currentWechat = parseFloat(wechatInput.value) || 0;
    wechatInput.value = (currentWechat + amount).toFixed(2);
    wechatInput.dispatchEvent(new Event('input', { bubbles: true }));

    // 删除该行（复用删除函数）
    deleteRow(btn);

    showToast(`核销成功，已添加 ${amount} 元到微信余额`, 'success');
}
// ==================== 历史记录 ====================
function saveCurrentRecord() {
    try {
        const accountInputs = document.querySelectorAll('.account-input');
        const accountDetails = [];
        accountInputs.forEach(input => accountDetails.push(input.value));

        const reimbursementInputs = document.querySelectorAll('.reimbursement-input');
        const reimbursementNames = document.querySelectorAll('#reimbursement-container .item-name');
        const reimbursementDetails = [];
        reimbursementInputs.forEach((input, index) => {
            reimbursementDetails.push({
                name: reimbursementNames[index] ? reimbursementNames[index].value : '',
                amount: input.value
            });
        });

        const totalClaimInput = document.getElementById('total-claim-input').value;
        const claimInputs = document.querySelectorAll('.claim-input');
        const claimNames = document.querySelectorAll('#claim-items-list .item-name');
        const claimDetails = [];
        claimInputs.forEach((input, index) => {
            claimDetails.push({
                name: claimNames[index] ? claimNames[index].value : '',
                amount: input.value
            });
        });

        const fixedInputs = document.querySelectorAll('.fixed-input');
        const fixedNames = document.querySelectorAll('#fixed-container .item-name');
        const fixedDetails = [];
        fixedInputs.forEach((input, index) => {
            fixedDetails.push({
                name: fixedNames[index] ? fixedNames[index].value : '',
                amount: input.value
            });
        });

        const record = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            currentDate: document.getElementById('current-date').value,
            salaryDay: document.getElementById('salary-day').value,
            totalAccounts: document.getElementById('total-accounts').textContent,
            totalReimbursement: document.getElementById('total-reimbursement').textContent,
            totalFixed: document.getElementById('total-fixed').textContent,
            totalClaimItems: document.getElementById('total-claim-items').textContent,
            personalAmount: document.getElementById('personal-amount').textContent,
            disposableBalance: document.getElementById('disposable-balance').textContent,
            remainingDays: document.getElementById('remaining-days').textContent,
            dailyAllocation: document.getElementById('daily-allocation').textContent,
            accountDetails: accountDetails,
            reimbursementDetails: reimbursementDetails,
            totalClaimInput: totalClaimInput,
            claimDetails: claimDetails,
            fixedDetails: fixedDetails
        };

        let history = JSON.parse(localStorage.getItem('financeHistory')) || [];
        history.unshift(record);
        if (history.length > 100) history = history.slice(0, 100);
        localStorage.setItem('financeHistory', JSON.stringify(history));

        loadHistory();
        showToast('记录保存成功', 'success');
    } catch (error) {
        console.error('保存记录失败:', error);
        showToast('保存失败，请重试', 'error');
    }
}

function loadHistory() {
    const historyList = document.getElementById('history-list');
    const emptyHistory = document.getElementById('empty-history');
    let history = JSON.parse(localStorage.getItem('financeHistory')) || [];

    if (history.length === 0) {
        emptyHistory.style.display = 'block';
        historyList.innerHTML = '';
        return;
    }

    emptyHistory.style.display = 'none';
    historyList.innerHTML = '';

    history.forEach((record, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-info">
                <div class="history-date">${record.date}</div>
                <div class="history-summary">
                    个人总金额: ${record.personalAmount} | 账户总金额: ${record.disposableBalance} | 剩余天数: ${record.remainingDays} | 每日可支配: ${record.dailyAllocation}
                </div>
            </div>
            <button class="btn btn-sm btn-primary load-history-btn" data-index="${index}">加载</button>
        `;
        historyList.appendChild(historyItem);
    });

    document.querySelectorAll('.load-history-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const index = this.getAttribute('data-index');
            const record = history[index];
            loadHistoryRecord(record);
        });
    });
}

function loadLatestRecord() {
    const history = JSON.parse(localStorage.getItem('financeHistory')) || [];
    if (history.length > 0) {
        loadHistoryRecord(history[0]);
        showToast('已自动加载最后一次保存的数据', 'success');
    }
}

function loadHistoryRecord(record) {
    try {
        document.getElementById('current-date').value = record.currentDate || '';
        document.getElementById('salary-day').value = record.salaryDay || '22';

        const accountInputs = document.querySelectorAll('.account-input');
        if (record.accountDetails && record.accountDetails.length === accountInputs.length) {
            accountInputs.forEach((input, i) => {
                input.value = record.accountDetails[i] || '0.00';
            });
        } else {
            accountInputs.forEach(input => input.value = '0.00');
        }

        document.getElementById('total-claim-input').value = record.totalClaimInput || '0.00';

        // 重建 reimbursement 行
        const reimbursementContainer = document.getElementById('reimbursement-container');
        // 移除所有现有的行（保留total-row）
        const existingRows = reimbursementContainer.querySelectorAll('.item-row:not(.total-row)');
        existingRows.forEach(row => row.remove());
        if (record.reimbursementDetails && record.reimbursementDetails.length > 0) {
            record.reimbursementDetails.forEach(detail => {
                const newRow = document.createElement('div');
                newRow.className = 'item-row';
                newRow.dataset.id = DataManager.generateId();
                newRow.innerHTML = `
                    <input type="text" class="item-name" placeholder="项目名称" value="${detail.name}" oninput="calculateAll()">
                    <input type="number" class="item-amount reimbursement-input" value="${detail.amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
                    <button class="item-reimburse" onclick="reimburseItem(this)">核销</button>
                    <button class="item-delete" onclick="deleteRow(this)">×</button>
                `;
                const totalRow = reimbursementContainer.querySelector('.total-row');
                reimbursementContainer.insertBefore(newRow, totalRow);
            });
        } else {
            // 确保至少有一行
            addRow('reimbursement');
        }

        // 重建 claim 行
        const claimList = document.getElementById('claim-items-list');
        claimList.innerHTML = ''; // 清空
        if (record.claimDetails && record.claimDetails.length > 0) {
            record.claimDetails.forEach(detail => {
                const newRow = document.createElement('div');
                newRow.className = 'item-row';
                newRow.dataset.id = DataManager.generateId();
                newRow.innerHTML = `
                    <input type="text" class="item-name" placeholder="项目名称" value="${detail.name}" oninput="calculateAll()">
                    <input type="number" class="item-amount claim-input" value="${detail.amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
                    <button class="item-delete" onclick="deleteRow(this)">×</button>
                `;
                claimList.appendChild(newRow);
            });
        } else {
            addRow('claim');
        }

        // 重建 fixed 行
        const fixedContainer = document.getElementById('fixed-container');
        const fixedRows = fixedContainer.querySelectorAll('.item-row:not(.total-row)');
        fixedRows.forEach(row => row.remove());
        if (record.fixedDetails && record.fixedDetails.length > 0) {
            record.fixedDetails.forEach(detail => {
                const newRow = document.createElement('div');
                newRow.className = 'item-row';
                newRow.dataset.id = DataManager.generateId();
                newRow.innerHTML = `
                    <input type="text" class="item-name" placeholder="项目名称" value="${detail.name}" oninput="calculateAll()">
                    <input type="number" class="item-amount fixed-input" value="${detail.amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
                    <button class="item-delete" onclick="deleteRow(this)">×</button>
                `;
                const totalRow = fixedContainer.querySelector('.total-row');
                fixedContainer.insertBefore(newRow, totalRow);
            });
        } else {
            addRow('fixed');
        }

        calculateAll();
        showToast('已加载所选历史记录', 'success');
    } catch (error) {
        console.error('加载历史记录失败:', error);
        showToast('加载失败，数据格式异常', 'error');
    }
}

function clearAllHistory() {
    if (confirm('确定清空所有历史记录？此操作不可恢复')) {
        localStorage.removeItem('financeHistory');
        loadHistory();
        showToast('已清空所有记录', 'success');
    }
}

// ==================== AI 聊天相关 ====================
function loadChatHistory() {
    const saved = localStorage.getItem('aiChatHistory');
    const chatHistory = document.getElementById('ai-chat-history');
    chatHistory.innerHTML = '';
    if (saved) {
        try {
            chatMessages = JSON.parse(saved);
            chatMessages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = msg.role === 'user' ? 'user-message' : 'ai-message';
                msgDiv.textContent = msg.content;
                chatHistory.appendChild(msgDiv);
            });
        } catch (e) {
            console.error('解析聊天历史失败', e);
            resetChatToDefault();
        }
    } else {
        resetChatToDefault();
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function resetChatToDefault() {
    chatMessages = [{
        role: 'assistant',
        content: '你好，我是Deepseek驱动的财务助理。在下方开启「API模式」并填入你的Deepseek API密钥即可使用。本地规则模式仍然可用。'
    }];
    saveChatToStorage();
    renderChatMessages();
}

function saveChatToStorage() {
    localStorage.setItem('aiChatHistory', JSON.stringify(chatMessages));
}

function renderChatMessages() {
    const chatHistory = document.getElementById('ai-chat-history');
    chatHistory.innerHTML = '';
    chatMessages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = msg.role === 'user' ? 'user-message' : 'ai-message';
        msgDiv.textContent = msg.content;
        chatHistory.appendChild(msgDiv);
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addChatMessage(role, content) {
    chatMessages.push({ role, content });
    saveChatToStorage();
    const chatHistory = document.getElementById('ai-chat-history');
    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user' ? 'user-message' : 'ai-message';
    msgDiv.textContent = content;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function clearAIConversation() {
    if (confirm('确定清空所有对话记录？此操作将同时清除AI记忆')) {
        localStorage.removeItem('aiChatHistory');
        localStorage.removeItem('aiMemory');
        resetChatToDefault();
        resetAIMemory();
        showToast('已清空对话记录和记忆', 'success');
    }
}

// ==================== AI 记忆相关 ====================
function loadAIMemory() {
    const saved = localStorage.getItem('aiMemory');
    if (saved) {
        try {
            aiMemory = JSON.parse(saved);
        } catch (e) {
            console.error('解析记忆失败', e);
            resetAIMemory();
        }
    } else {
        resetAIMemory();
    }
}

function resetAIMemory() {
    aiMemory = {
        userName: null,
        summaries: []
    };
    saveAIMemory();
}

function saveAIMemory() {
    localStorage.setItem('aiMemory', JSON.stringify(aiMemory));
}

function extractUserNameFromText(text) {
    const patterns = [
        /我叫\s*([^\s，。]{1,10})/,
        /我是\s*([^\s，。]{1,10})/,
        /我的名字是\s*([^\s，。]{1,10})/
    ];
    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

function generateSummary(userMsg, aiReply) {
    let summary = '';
    const name = extractUserNameFromText(userMsg);
    if (name && !aiMemory.userName) {
        aiMemory.userName = name;
        summary += `用户姓名：${name}。`;
    }
    const keywords = [];
    if (userMsg.includes('收入') || userMsg.includes('工资')) keywords.push('收入');
    if (userMsg.includes('支出') || userMsg.includes('消费')) keywords.push('支出');
    if (userMsg.includes('报销')) keywords.push('报销');
    if (userMsg.includes('请款')) keywords.push('请款');
    if (userMsg.includes('固定支出')) keywords.push('固定支出');
    if (keywords.length > 0) {
        summary += `本次讨论关键词：${keywords.join('、')}。`;
    }
    if (userMsg.includes('余额') || userMsg.includes('总金额')) {
        summary += '用户查询了账户余额。';
    }
    return summary || '普通对话。';
}

function updateMemoryAfterChat(userMsg, aiReply) {
    const summary = generateSummary(userMsg, aiReply);
    if (summary) {
        aiMemory.summaries.push({
            time: new Date().toLocaleString(),
            summary: summary
        });
        if (aiMemory.summaries.length > 10) {
            aiMemory.summaries = aiMemory.summaries.slice(-10);
        }
        saveAIMemory();
    }
}

function getMemoryContext() {
    let context = '';
    if (aiMemory.userName) {
        context += `用户姓名：${aiMemory.userName}。`;
    }
    if (aiMemory.summaries.length > 0) {
        context += '以下是之前对话的摘要：\n';
        aiMemory.summaries.forEach((item, index) => {
            context += `${index+1}. ${item.summary}\n`;
        });
    }
    return context;
}

// ==================== AI 发送消息 ====================
async function sendAIMessage() {
    const input = document.getElementById('ai-user-input');
    const content = input.value.trim();
    if (!content) {
        showToast('请输入内容', 'error');
        return;
    }

    addChatMessage('user', content);
    input.value = '';

    // 显示加载中
    const chatHistory = document.getElementById('ai-chat-history');
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'ai-message';
    loadingMsg.textContent = '对方正在输入...';
    chatHistory.appendChild(loadingMsg);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const reply = await AIService.handleUserMessage(content);
        // 移除加载消息
        loadingMsg.remove();
        addChatMessage('assistant', reply);
        updateMemoryAfterChat(content, reply);
    } catch (error) {
        loadingMsg.remove();
        const errorMsg = `请求失败：${error.message}`;
        addChatMessage('assistant', errorMsg);
        showToast('AI响应失败', 'error');
    }
}

// ==================== API 测试 ====================
function testAPIConnection() {
    const apiMode = document.getElementById('api-mode-checkbox').checked;
    if (!apiMode) {
        showToast('请先启用API模式', 'error');
        return;
    }

    const apiUrl = document.getElementById('api-url').value;
    const apiKey = document.getElementById('api-key').value;

    if (!apiKey || !apiKey.startsWith('sk-')) {
        showToast('请输入有效的API Key', 'error');
        return;
    }

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: document.getElementById('api-model').value,
            messages: [{ role: 'user', content: '测试连接' }],
            temperature: 0.7
        })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error(`HTTP错误：${response.status}`);
        }
    })
    .then(data => {
        if (data.choices && data.choices.length > 0) {
            showToast('API连接成功', 'success');
        } else {
            throw new Error('响应格式异常');
        }
    })
    .catch(error => {
        console.error('API测试失败:', error);
        showToast('API连接失败，请检查配置', 'error');
    });
}

// 将全局函数挂载到window，以便HTML事件调用
window.switchTab = switchTab;
window.switchSection = switchSection;
window.addRow = addRow;
window.deleteRow = deleteRow;
window.calculateAll = calculateAll;
window.syncCurrentDate = syncCurrentDate;
window.saveCurrentRecord = saveCurrentRecord;
window.clearAllHistory = clearAllHistory;
window.showToast = showToast;
window.sendAIMessage = sendAIMessage;
window.clearAIConversation = clearAIConversation;
window.testAPIConnection = testAPIConnection;
window.reimburseItem = reimburseItem;