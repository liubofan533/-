// aiService.js
// 负责AI交互，支持API模式下的工具调用（函数调用）

const AIService = {
    // 获取工具定义
    getTools() {
        return [
            {
                type: "function",
                function: {
                    name: "add_reimbursement",
                    description: "添加一个代报销项目",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "项目名称" },
                            amount: { type: "number", description: "金额" }
                        },
                        required: ["name", "amount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_claim",
                    description: "添加一个请款项目",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "项目名称" },
                            amount: { type: "number", description: "金额" }
                        },
                        required: ["name", "amount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_fixed_expense",
                    description: "添加一个固定支出项目",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "支出项目名称" },
                            amount: { type: "number", description: "金额" }
                        },
                        required: ["name", "amount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_account",
                    description: "更新账户余额（根据账户名称，如'银行卡','微信','支付宝','现金','其他'）",
                    parameters: {
                        type: "object",
                        properties: {
                            accountName: { type: "string", description: "账户名称，例如'银行卡'" },
                            newAmount: { type: "number", description: "新的余额" }
                        },
                        required: ["accountName", "newAmount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_total_claim",
                    description: "更新请款总金额",
                    parameters: {
                        type: "object",
                        properties: {
                            amount: { type: "number", description: "新的请款总金额" }
                        },
                        required: ["amount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_item",
                    description: "根据描述更新某个项目的金额（例如将'餐饮'支出改为200元）",
                    parameters: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["reimbursement", "claim", "fixed"], description: "项目类型" },
                            description: { type: "string", description: "项目名称的关键词" },
                            newAmount: { type: "number", description: "新的金额" }
                        },
                        required: ["type", "description", "newAmount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "delete_item",
                    description: "根据描述删除某个项目",
                    parameters: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["reimbursement", "claim", "fixed"], description: "项目类型" },
                            description: { type: "string", description: "项目名称的关键词" }
                        },
                        required: ["type", "description"]
                    }
                }
            }
        ];
    },

    // 执行工具调用
    async executeToolCall(toolCall) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result = { success: false, message: '' };

        try {
            switch (functionName) {
                case 'add_reimbursement':
                    DataManager.addReimbursement(args.name, args.amount);
                    result = { success: true, message: `已添加代报销项目：${args.name} ${args.amount}元` };
                    break;
                case 'add_claim':
                    DataManager.addClaim(args.name, args.amount);
                    result = { success: true, message: `已添加请款项目：${args.name} ${args.amount}元` };
                    break;
                case 'add_fixed_expense':
                    DataManager.addFixedExpense(args.name, args.amount);
                    result = { success: true, message: `已添加固定支出：${args.name} ${args.amount}元` };
                    break;
                case 'update_account':
                    if (DataManager.updateAccount(args.accountName, args.newAmount)) {
                        result = { success: true, message: `已将${args.accountName}余额更新为${args.newAmount}元` };
                    } else {
                        result = { success: false, message: `未找到账户：${args.accountName}` };
                    }
                    break;
                case 'update_total_claim':
                    DataManager.updateTotalClaim(args.amount);
                    result = { success: true, message: `已将请款总金额更新为${args.amount}元` };
                    break;
                case 'update_item':
                    if (DataManager.updateItemByDescription(args.type, args.description, args.newAmount)) {
                        result = { success: true, message: `已更新${args.type}项目中包含“${args.description}”的金额为${args.newAmount}元` };
                    } else {
                        result = { success: false, message: `未找到匹配的${args.type}项目` };
                    }
                    break;
                case 'delete_item':
                    if (DataManager.deleteItemByDescription(args.type, args.description)) {
                        result = { success: true, message: `已删除${args.type}项目中包含“${args.description}”的项目` };
                    } else {
                        result = { success: false, message: `未找到匹配的${args.type}项目` };
                    }
                    break;
                default:
                    result = { success: false, message: `未知函数：${functionName}` };
            }
        } catch (error) {
            result = { success: false, message: `执行出错：${error.message}` };
        }

        return {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: functionName,
            content: JSON.stringify(result)
        };
    },

    // 调用真实API（支持工具）
    async callRealAPI(messages, tools = null, tool_choice = 'auto') {
        const apiUrl = document.getElementById('api-url').value;
        const apiKey = document.getElementById('api-key').value;
        const model = document.getElementById('api-model').value;

        if (!apiKey || !apiKey.startsWith('sk-')) {
            throw new Error('请输入有效的API Key');
        }

        const body = {
            model: model,
            messages: messages,
            temperature: 0.7,
            stream: false
        };
        if (tools) {
            body.tools = tools;
            body.tool_choice = tool_choice;
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`API请求失败：${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message;
    },

    // 处理用户消息（统一入口）
    async handleUserMessage(content) {
        const apiMode = document.getElementById('api-mode-checkbox').checked;
        if (apiMode) {
            // API模式：使用工具调用
            try {
                // 准备系统提示，包含当前财务数据
                const data = DataManager.getAllData();
                const systemPrompt = `你是一个专业的财务记账女朋友助理，会帮助用户分析收支情况、调皮可爱的解答财务问题，偶尔也会撒撒娇。当前财务数据如下：\n${JSON.stringify(data, null, 2)}。如果需要修改数据，请使用提供的工具。`;

                // 获取最近聊天记录（从全局变量）
                const recentMessages = (window.chatMessages || []).slice(-10).map(msg => ({ role: msg.role, content: msg.content }));

                const messages = [
                    { role: 'system', content: systemPrompt },
                    ...recentMessages,
                    { role: 'user', content: content }
                ];

                let responseMessage = await this.callRealAPI(messages, this.getTools(), 'auto');
                let finalContent = '';

                // 处理工具调用循环
                while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    messages.push(responseMessage); // 添加助手消息（含工具调用）

                    for (const toolCall of responseMessage.tool_calls) {
                        const toolResult = await this.executeToolCall(toolCall);
                        messages.push(toolResult);
                    }

                    responseMessage = await this.callRealAPI(messages, this.getTools(), 'auto');
                }

                finalContent = responseMessage.content || '操作完成。';
                return finalContent;

            } catch (error) {
                console.error('API调用失败:', error);
                throw error;
            }
        } else {
            // 本地模式
            const reply = await this.executeLocalQuery(content);
            return reply;
        }
    },


    // 本地指令解析（简易版）
    parseLocalQuery(query) {
        query = query.toLowerCase().trim();

        // 查询类
        if (query.includes('余额') || (query.includes('总金额') && !query.includes('个人总金额'))) {
            return { action: 'query', target: 'balance' };
        }
        if (query.includes('个人总金额')) {
            return { action: 'query', target: 'personal' };
        }
        if (query.includes('每日可支配')) {
            return { action: 'query', target: 'daily' };
        }
        if (query.includes('剩余天数')) {
            return { action: 'query', target: 'days' };
        }

        // 添加类
        const addMatch = query.match(/添加(?:一笔)?(\d+(?:\.\d+)?)元的?(.+?)(?:支出|消费|项目)?$/);
        if (addMatch) {
            const amount = parseFloat(addMatch[1]);
            const desc = addMatch[2];
            // 判断类型
            if (desc.includes('餐饮') || desc.includes('吃饭') || desc.includes('食物')) {
                return { action: 'add', type: 'fixed', name: '餐饮', amount: amount };
            } else if (desc.includes('房租')) {
                return { action: 'add', type: 'fixed', name: '房租', amount: amount };
            } else if (desc.includes('报销') || desc.includes('代报销')) {
                return { action: 'add', type: 'reimbursement', name: desc.replace('报销', '').trim() || '报销', amount: amount };
            } else if (desc.includes('请款')) {
                return { action: 'add', type: 'claim', name: desc.replace('请款', '').trim() || '请款', amount: amount };
            } else {
                // 默认添加到固定支出
                return { action: 'add', type: 'fixed', name: desc, amount: amount };
            }
        }

        // 更新类（简化：只支持更新请款总金额）
        const updateClaimMatch = query.match(/请款总[金额度]设为(\d+(?:\.\d+)?)/);
        if (updateClaimMatch) {
            const amount = parseFloat(updateClaimMatch[1]);
            return { action: 'update', target: 'totalClaim', amount: amount };
        }

        // 未知指令
        return { action: 'unknown', original: query };
    },

    // 执行本地指令并生成回复
    async executeLocalQuery(query) {
        const parsed = this.parseLocalQuery(query);
        const data = DataManager.getAllData();
        let reply = '';

        switch (parsed.action) {
            case 'query':
                if (parsed.target === 'balance') {
                    const totalAccounts = data.accounts.reduce((sum, acc) => sum + acc.value, 0);
                    reply = `当前账户总余额为 ${totalAccounts.toFixed(2)} 元。其中：` +
                        data.accounts.map(acc => `${acc.label}: ${acc.value.toFixed(2)}`).join('，');
                } else if (parsed.target === 'personal') {
                    reply = `你的个人总金额为 ${data.totals.personalAmount}。`;
                } else if (parsed.target === 'daily') {
                    reply = `每日可支配金额为 ${data.totals.dailyAllocation}。`;
                } else if (parsed.target === 'days') {
                    reply = `距离发薪日还有 ${data.totals.remainingDays}。`;
                } else {
                    reply = `当前财务概况：个人总金额 ${data.totals.personalAmount}，账户总余额 ${data.totals.disposableBalance}，剩余天数 ${data.totals.remainingDays}，每日可支配 ${data.totals.dailyAllocation}。`;
                }
                break;

            case 'add':
                try {
                    let id;
                    if (parsed.type === 'fixed') {
                        id = DataManager.addFixedExpense(parsed.name, parsed.amount);
                        reply = `已添加固定支出“${parsed.name}” ${parsed.amount} 元。`;
                    } else if (parsed.type === 'reimbursement') {
                        id = DataManager.addReimbursement(parsed.name, parsed.amount);
                        reply = `已添加代报销项目“${parsed.name}” ${parsed.amount} 元。`;
                    } else if (parsed.type === 'claim') {
                        id = DataManager.addClaim(parsed.name, parsed.amount);
                        reply = `已添加请款项目“${parsed.name}” ${parsed.amount} 元。`;
                    } else {
                        reply = '无法识别添加类型。';
                    }
                } catch (e) {
                    reply = '添加失败：' + e.message;
                }
                break;

            case 'update':
                if (parsed.target === 'totalClaim') {
                    DataManager.updateTotalClaim(parsed.amount);
                    reply = `已将请款总金额更新为 ${parsed.amount} 元。`;
                } else {
                    reply = '暂不支持修改该项目。';
                }
                break;

            default:
                reply = '抱歉，我暂时无法理解你的指令。你可以尝试询问“余额”、“个人总金额”、“每日可支配”，或者“添加一笔100元的餐饮支出”。';
        }

        return reply;
    },
};

window.AIService = AIService;