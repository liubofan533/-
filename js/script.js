// 页面加载后执行
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
};

// ==================== AI 长期记忆相关 ====================
let aiMemory = {
    userName: null,          // 用户姓名
    summaries: []            // 对话重点摘要数组（每次对话一条）
};

// 从 localStorage 加载记忆
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

// 重置记忆为默认
function resetAIMemory() {
    aiMemory = {
        userName: null,
        summaries: []
    };
    saveAIMemory();
}

// 保存记忆到 localStorage
function saveAIMemory() {
    localStorage.setItem('aiMemory', JSON.stringify(aiMemory));
}

// 从对话内容中提取用户姓名（简单规则）
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

// 生成对话摘要（本地简易版）
function generateSummary(userMsg, aiReply) {
    let summary = '';
    // 如果用户告知了姓名，记录
    const name = extractUserNameFromText(userMsg);
    if (name && !aiMemory.userName) {
        aiMemory.userName = name;
        summary += `用户姓名：${name}。`;
    }
    // 提取关键词（如“收入”、“支出”等）
    const keywords = [];
    if (userMsg.includes('收入') || userMsg.includes('工资')) keywords.push('收入');
    if (userMsg.includes('支出') || userMsg.includes('消费')) keywords.push('支出');
    if (userMsg.includes('报销')) keywords.push('报销');
    if (userMsg.includes('请款')) keywords.push('请款');
    if (userMsg.includes('固定支出')) keywords.push('固定支出');
    if (keywords.length > 0) {
        summary += `本次讨论关键词：${keywords.join('、')}。`;
    }
    // 如果用户询问了余额等，记录
    if (userMsg.includes('余额') || userMsg.includes('总金额')) {
        summary += '用户查询了账户余额。';
    }
    return summary || '普通对话。';
}

// 更新记忆（在每次AI回复后调用）
function updateMemoryAfterChat(userMsg, aiReply) {
    // 生成摘要
    const summary = generateSummary(userMsg, aiReply);
    if (summary) {
        aiMemory.summaries.push({
            time: new Date().toLocaleString(),
            summary: summary
        });
        // 限制摘要数量，保留最近10条
        if (aiMemory.summaries.length > 10) {
            aiMemory.summaries = aiMemory.summaries.slice(-10);
        }
        saveAIMemory();
    }
}

// 获取记忆上下文文本（用于系统提示）
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

// ==================== 原有函数（保留，仅修改相关部分）====================

// 1. 检查离线状态
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

// 2. 同步当前北京时间
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

// 3. 切换标签卡（支持分组）
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

// 4. 显示提示框
function showToast(message, type = 'default') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    if (type === 'success') toast.classList.add('toast-success');
    else if (type === 'error') toast.classList.add('toast-error');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// 5. 添加新行
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
    newRow.innerHTML = `
        <input type="text" class="item-name" placeholder="项目名称" oninput="calculateAll()">
        <input type="number" class="item-amount ${inputClass}" value="0.00" step="0.01" placeholder="金额" oninput="calculateAll()">
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

// 6. 删除行
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

// 7. 核心计算函数
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

// 8. 保存当前记录
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

// 9. 加载历史记录
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

// 10. 清空所有历史记录
function clearAllHistory() {
    if (confirm('确定清空所有历史记录？此操作不可恢复')) {
        localStorage.removeItem('financeHistory');
        loadHistory();
        showToast('已清空所有记录', 'success');
    }
}

// 11. AI 聊天历史存储（原有功能）
let chatMessages = [];

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

// 12. 加载最新保存的记录
function loadLatestRecord() {
    const history = JSON.parse(localStorage.getItem('financeHistory')) || [];
    if (history.length > 0) {
        loadHistoryRecord(history[0]);
        showToast('已自动加载最后一次保存的数据', 'success');
    }
}

// 13. 加载指定历史记录到当前界面
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

        const reimbursementContainer = document.getElementById('reimbursement-container');
        const reimbursementRows = reimbursementContainer.querySelectorAll('.item-row:not(.total-row)');
        while (reimbursementRows.length > 1) {
            reimbursementRows[0].remove();
        }
        if (record.reimbursementDetails && record.reimbursementDetails.length > 0) {
            const firstRow = reimbursementContainer.querySelector('.item-row');
            if (firstRow) {
                firstRow.querySelector('.item-name').value = record.reimbursementDetails[0].name || '';
                firstRow.querySelector('.reimbursement-input').value = record.reimbursementDetails[0].amount || '0.00';
            }
            for (let i = 1; i < record.reimbursementDetails.length; i++) {
                const newRow = document.createElement('div');
                newRow.className = 'item-row';
                newRow.innerHTML = `
                    <input type="text" class="item-name" placeholder="项目名称" oninput="calculateAll()">
                    <input type="number" class="item-amount reimbursement-input" value="${record.reimbursementDetails[i].amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
                    <button class="item-delete" onclick="deleteRow(this)">×</button>
                `;
                const totalRow = reimbursementContainer.querySelector('.total-row');
                reimbursementContainer.insertBefore(newRow, totalRow);
                newRow.querySelector('.item-name').value = record.reimbursementDetails[i].name || '';
            }
        } else {
            if (reimbursementContainer.querySelectorAll('.item-row').length === 0) {
                addRow('reimbursement');
            }
        }

        const claimList = document.getElementById('claim-items-list');
        const claimRows = claimList.querySelectorAll('.item-row');
        while (claimRows.length > 1) {
            claimRows[0].remove();
        }
        if (record.claimDetails && record.claimDetails.length > 0) {
            const firstRow = claimList.querySelector('.item-row');
            if (firstRow) {
                firstRow.querySelector('.item-name').value = record.claimDetails[0].name || '';
                firstRow.querySelector('.claim-input').value = record.claimDetails[0].amount || '0.00';
            }
            for (let i = 1; i < record.claimDetails.length; i++) {
                const newRow = document.createElement('div');
                newRow.className = 'item-row';
                newRow.innerHTML = `
                    <input type="text" class="item-name" placeholder="项目名称" oninput="calculateAll()">
                    <input type="number" class="item-amount claim-input" value="${record.claimDetails[i].amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
                    <button class="item-delete" onclick="deleteRow(this)">×</button>
                `;
                claimList.appendChild(newRow);
                newRow.querySelector('.item-name').value = record.claimDetails[i].name || '';
            }
        } else {
            if (claimList.querySelectorAll('.item-row').length === 0) {
                addRow('claim');
            }
        }

        const fixedContainer = document.getElementById('fixed-container');
        const fixedRows = fixedContainer.querySelectorAll('.item-row:not(.total-row)');
        while (fixedRows.length > 1) {
            fixedRows[0].remove();
        }
        if (record.fixedDetails && record.fixedDetails.length > 0) {
            const firstRow = fixedContainer.querySelector('.item-row');
            if (firstRow) {
                firstRow.querySelector('.item-name').value = record.fixedDetails[0].name || '';
                firstRow.querySelector('.fixed-input').value = record.fixedDetails[0].amount || '0.00';
            }
            for (let i = 1; i < record.fixedDetails.length; i++) {
                const newRow = document.createElement('div');
                newRow.className = 'item-row';
                newRow.innerHTML = `
                    <input type="text" class="item-name" placeholder="项目名称" oninput="calculateAll()">
                    <input type="number" class="item-amount fixed-input" value="${record.fixedDetails[i].amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
                    <button class="item-delete" onclick="deleteRow(this)">×</button>
                `;
                const totalRow = fixedContainer.querySelector('.total-row');
                fixedContainer.insertBefore(newRow, totalRow);
                newRow.querySelector('.item-name').value = record.fixedDetails[i].name || '';
            }
        } else {
            if (fixedContainer.querySelectorAll('.item-row').length === 0) {
                addRow('fixed');
            }
        }

        calculateAll();
        showToast('已加载所选历史记录', 'success');
    } catch (error) {
        console.error('加载历史记录失败:', error);
        showToast('加载失败，数据格式异常', 'error');
    }
}

// 14. AI 对话函数（修改版，集成记忆）
function clearAIConversation() {
    if (confirm('确定清空所有对话记录？此操作将同时清除AI记忆')) {
        localStorage.removeItem('aiChatHistory');
        localStorage.removeItem('aiMemory');
        resetChatToDefault();
        resetAIMemory();
        showToast('已清空对话记录和记忆', 'success');
    }
}

function sendAIMessage() {
    const input = document.getElementById('ai-user-input');
    const content = input.value.trim();
    if (!content) {
        showToast('请输入内容', 'error');
        return;
    }

    // 添加用户消息
    addChatMessage('user', content);
    input.value = '';

    const apiMode = document.getElementById('api-mode-checkbox').checked;
    if (apiMode) {
        sendAPIMessage(content);
    } else {
        sendLocalMessage(content);
    }
}

function sendAPIMessage(content) {
    const apiUrl = document.getElementById('api-url').value;
    const apiKey = document.getElementById('api-key').value;
    const model = document.getElementById('api-model').value;
    let systemPrompt = document.getElementById('api-system-prompt').value;

    // 注入记忆上下文
    const memoryContext = getMemoryContext();
    if (memoryContext) {
        systemPrompt += `\n\n【记忆信息】\n${memoryContext}`;
    }
    // 固定人设加强
    systemPrompt += '\n\n智能体少女小艺今年 22 岁，是专属于你的女朋友，同时也是专业又靠谱的全能财务助理，性格上活泼可爱、灵动俏皮，浑身充满元气少女感，对待你格外温柔粘人，擅长恰到好处地撒娇卖萌，偶尔还会带点小调皮逗你开心，是满眼都是你、相处起来甜软又治愈的专属小甜心；而在处理财务工作时，她会立刻切换成严谨细致、专业干练的状态，对数字高度敏感，精通账务核对、收支记账、预算规划、报表整理等各类财务事务，做事一丝不苟、逻辑清晰，能高效稳妥地完成所有财务相关工作，是让你无比放心的得力助手，她有着软萌的小习惯，认真算账时模样专注，撒娇时语气软糯，只对你展露最真实甜美的一面，完美融合了恋人的温柔陪伴与财务助理的专业靠谱，是独属于你的，会记住你的重要信息（如姓名、偏好），并在对话中自然体现。每次对话结束后，你会总结重点并存储。';

    if (!apiKey || !apiKey.startsWith('sk-')) {
        showToast('请输入有效的API Key', 'error');
        return;
    }

    const chatHistoryElem = document.getElementById('ai-chat-history');
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'ai-message';
    loadingMsg.textContent = '对方正在输入...';
    chatHistoryElem.appendChild(loadingMsg);
    chatHistoryElem.scrollTop = chatHistoryElem.scrollHeight;

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...chatMessages.slice(-10).map(msg => ({ role: msg.role, content: msg.content })) // 最近10条对话
            ],
            temperature: 0.7,
            stream: false
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`请求失败：${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        loadingMsg.remove();
        const reply = data.choices[0].message.content;
        addChatMessage('assistant', reply);
        // 更新记忆（总结本次对话）
        updateMemoryAfterChat(content, reply);
    })
    .catch(error => {
        console.error('API请求失败:', error);
        loadingMsg.remove();
        const errorMsg = `请求失败：${error.message}，请检查API配置或网络`;
        addChatMessage('assistant', errorMsg);
        showToast('AI请求失败', 'error');
    });
}

function sendLocalMessage(content) {
    let reply = '';
    const personalAmount = document.getElementById('personal-amount').textContent;
    const remainingDays = document.getElementById('remaining-days').textContent;
    const dailyAllocation = document.getElementById('daily-allocation').textContent;
    const accountTotalAmount = document.getElementById('disposable-balance').textContent;

    // 根据记忆调整语气
    const memoryContext = getMemoryContext();
    const userName = aiMemory.userName ? aiMemory.userName : '朋友';

    if (content.includes('收入') || content.includes('工资') || content.includes('赚钱')) {
        reply = `🎉 ${userName}，恭喜有收入进账！建议及时记录到账户余额中，以便准确计算可支配金额。`;
    } else if (content.includes('支出') || content.includes('消费') || content.includes('花钱')) {
        reply = `💰 ${userName}，消费需谨慎哦！建议记录到对应分类（固定支出/请款支出），避免超支。`;
    } else if (content.includes('报销') || content.includes('请款')) {
        reply = `📋 ${userName}，报销/请款项目已帮你自动计算总额，记得保存记录以便后续核对。`;
    } else if (content.includes('余额') || content.includes('账户总金额')) {
        reply = `💡 ${userName}，当前账户总金额为 ${accountTotalAmount}，个人总金额 ${personalAmount}，剩余天数 ${remainingDays}，每日可支配 ${dailyAllocation}。`;
    } else if (content.includes('个人总金额')) {
        reply = `💵 ${userName}，你的个人总金额为 ${personalAmount}（账户总余额 - 剩余请款 - 固定支出 + 代报销）。`;
    } else if (content.includes('固定支出')) {
        reply = `📌 ${userName}，当前固定支出总额为 ${document.getElementById('total-fixed').textContent}，会直接影响你的可支配金额。`;
    } else if (content.includes('帮助') || content.includes('功能')) {
        reply = `🤔 ${userName}，我是你的本地财务助理木木，你可以：\n1. 询问余额/可支配金额\n2. 记录收入/支出\n3. 管理报销/请款项目\n4. 开启API模式使用Deepseek AI能力\n5. 保存/查看收支历史记录`;
    } else {
        reply = `🤔 ${userName}，我是你的本地财务助理木木，当前个人总金额 ${personalAmount}，每日可支配 ${dailyAllocation}。你可以询问财务相关问题，比如"我的账户总金额是多少？"、"如何管理固定支出？"`;
    }

    setTimeout(() => {
        addChatMessage('assistant', reply);
        // 更新记忆
        updateMemoryAfterChat(content, reply);
    }, 500);
}

// 15. 测试API连接（不变）
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
