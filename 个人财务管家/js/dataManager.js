// dataManager.js
// 负责所有财务数据的CRUD操作，直接操作DOM

const DataManager = {
    // 生成唯一ID
    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    },

    // 获取所有账户余额
    getAccounts() {
        const inputs = document.querySelectorAll('.account-input');
        const accounts = [];
        inputs.forEach(input => {
            accounts.push({
                id: input.dataset.id || this.generateId(),
                label: input.closest('.data-item')?.querySelector('.data-label')?.textContent || '未知',
                value: parseFloat(input.value) || 0
            });
        });
        return accounts;
    },

    // 获取代报销项目
    getReimbursements() {
        const rows = document.querySelectorAll('#reimbursement-container .item-row:not(.total-row)');
        const items = [];
        rows.forEach(row => {
            const nameInput = row.querySelector('.item-name');
            const amountInput = row.querySelector('.reimbursement-input');
            items.push({
                id: row.dataset.id || this.generateId(),
                name: nameInput ? nameInput.value : '',
                amount: parseFloat(amountInput ? amountInput.value : 0) || 0
            });
        });
        return items;
    },

    // 获取请款项目
    getClaims() {
        const rows = document.querySelectorAll('#claim-items-list .item-row');
        const items = [];
        rows.forEach(row => {
            const nameInput = row.querySelector('.item-name');
            const amountInput = row.querySelector('.claim-input');
            items.push({
                id: row.dataset.id || this.generateId(),
                name: nameInput ? nameInput.value : '',
                amount: parseFloat(amountInput ? amountInput.value : 0) || 0
            });
        });
        return items;
    },

    // 获取固定支出
    getFixedExpenses() {
        const rows = document.querySelectorAll('#fixed-container .item-row:not(.total-row)');
        const items = [];
        rows.forEach(row => {
            const nameInput = row.querySelector('.item-name');
            const amountInput = row.querySelector('.fixed-input');
            items.push({
                id: row.dataset.id || this.generateId(),
                name: nameInput ? nameInput.value : '',
                amount: parseFloat(amountInput ? amountInput.value : 0) || 0
            });
        });
        return items;
    },

    // 获取所有财务数据（用于AI上下文）
    getAllData() {
        return {
            accounts: this.getAccounts(),
            reimbursements: this.getReimbursements(),
            claims: this.getClaims(),
            fixedExpenses: this.getFixedExpenses(),
            totalClaim: parseFloat(document.getElementById('total-claim-input').value) || 0,
            totals: {
                personalAmount: document.getElementById('personal-amount').textContent,
                disposableBalance: document.getElementById('disposable-balance').textContent,
                remainingDays: document.getElementById('remaining-days').textContent,
                dailyAllocation: document.getElementById('daily-allocation').textContent
            }
        };
    },

    // 添加代报销项目
    addReimbursement(name, amount) {
        const container = document.getElementById('reimbursement-container');
        const totalRow = container.querySelector('.total-row');
        const newRow = document.createElement('div');
        newRow.className = 'item-row';
        const id = this.generateId();
        newRow.dataset.id = id;
        newRow.innerHTML = `
            <input type="text" class="item-name" placeholder="项目名称" value="${name}" oninput="calculateAll()">
            <input type="number" class="item-amount reimbursement-input" value="${amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
            <button class="item-delete" onclick="deleteRow(this)">×</button>
        `;
        container.insertBefore(newRow, totalRow);
        calculateAll(); // 触发重新计算
        return id;
    },

    // 添加请款项目
    addClaim(name, amount) {
        const container = document.getElementById('claim-items-list');
        const newRow = document.createElement('div');
        newRow.className = 'item-row';
        const id = this.generateId();
        newRow.dataset.id = id;
        newRow.innerHTML = `
            <input type="text" class="item-name" placeholder="项目名称" value="${name}" oninput="calculateAll()">
            <input type="number" class="item-amount claim-input" value="${amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
            <button class="item-delete" onclick="deleteRow(this)">×</button>
        `;
        container.appendChild(newRow);
        calculateAll();
        return id;
    },

    // 添加固定支出
    addFixedExpense(name, amount) {
        const container = document.getElementById('fixed-container');
        const totalRow = container.querySelector('.total-row');
        const newRow = document.createElement('div');
        newRow.className = 'item-row';
        const id = this.generateId();
        newRow.dataset.id = id;
        newRow.innerHTML = `
            <input type="text" class="item-name" placeholder="支出项目" value="${name}" oninput="calculateAll()">
            <input type="number" class="item-amount fixed-input" value="${amount}" step="0.01" placeholder="金额" oninput="calculateAll()">
            <button class="item-delete" onclick="deleteRow(this)">×</button>
        `;
        container.insertBefore(newRow, totalRow);
        calculateAll();
        return id;
    },

    // 更新账户余额（根据账户名称，如'银行卡','微信'等）
    updateAccount(accountName, newAmount) {
        const accountItems = document.querySelectorAll('.data-item');
        for (let item of accountItems) {
            const label = item.querySelector('.data-label');
            if (label && label.textContent.includes(accountName)) {
                const input = item.querySelector('.account-input');
                if (input) {
                    input.value = newAmount;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    calculateAll();
                    return true;
                }
            }
        }
        return false;
    },

    // 更新请款总金额
    updateTotalClaim(amount) {
        const input = document.getElementById('total-claim-input');
        if (input) {
            input.value = amount;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            calculateAll();
            return true;
        }
        return false;
    },

    // 根据ID更新项目金额（用于精确修改）
    updateItemById(type, id, newAmount) {
        let selector = '';
        switch (type) {
            case 'reimbursement':
                selector = `#reimbursement-container .item-row[data-id="${id}"] .reimbursement-input`;
                break;
            case 'claim':
                selector = `#claim-items-list .item-row[data-id="${id}"] .claim-input`;
                break;
            case 'fixed':
                selector = `#fixed-container .item-row[data-id="${id}"] .fixed-input`;
                break;
            default:
                return false;
        }
        const input = document.querySelector(selector);
        if (input) {
            input.value = newAmount;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            calculateAll();
            return true;
        }
        return false;
    },

    // 删除项目（通过删除按钮）
    deleteItem(deleteButton) {
        const row = deleteButton.closest('.item-row');
        if (row) {
            const parent = row.parentNode;
            const rows = parent.querySelectorAll('.item-row');
            if (rows.length <= 1) {
                showToast('至少保留一项', 'error');
                return false;
            }
            row.remove();
            calculateAll();
            showToast('已删除该项', 'success');
            return true;
        }
        return false;
    },

    // 在DataManager中添加
    findItemByDescription(type, description) {
        description = description.toLowerCase().trim();
        let items = [];
        switch (type) {
            case 'reimbursement':
                items = this.getReimbursements();
                break;
            case 'claim':
                items = this.getClaims();
                break;
            case 'fixed':
                items = this.getFixedExpenses();
                break;
            default:
                return null;
        }
        return items.find(item => item.name.toLowerCase().includes(description)) || null;
    },

    updateItemByDescription(type, description, newAmount) {
        const item = this.findItemByDescription(type, description);
        if (!item) return false;
        return this.updateItemById(type, item.id, newAmount);
    },

    deleteItemById(type, id) {
        let row = null;
        if (type === 'reimbursement') {
            row = document.querySelector(`#reimbursement-container .item-row[data-id="${id}"]`);
        } else if (type === 'claim') {
            row = document.querySelector(`#claim-items-list .item-row[data-id="${id}"]`);
        } else if (type === 'fixed') {
            row = document.querySelector(`#fixed-container .item-row[data-id="${id}"]`);
        }
        if (row) {
            const deleteBtn = row.querySelector('.item-delete');
            if (deleteBtn) {
                deleteBtn.click();
                return true;
            }
        }
        return false;
    },

    deleteItemByDescription(type, description) {
        const item = this.findItemByDescription(type, description);
        if (!item) return false;
        return this.deleteItemById(type, item.id);
    },
};

window.DataManager = DataManager;