import type { PlasmoMessaging } from "@anthropic/plasmo"

// 后台服务工作者

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-to-cortex",
        title: "保存到第二大脑",
        contexts: ["selection", "page"],
    })
    console.log("🧠 第二大脑 Background Service Worker initialized")
})

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-to-cortex") {
        const content = info.selectionText || ""
        const pageUrl = tab?.url || ""
        const pageTitle = tab?.title || "Untitled"

        if (!content) {
            console.log("没有选中内容")
            return
        }

        await saveToLocalServer({
            content,
            title: `Selection: ${pageTitle}`,
            source_url: pageUrl,
            source_type: "context-menu",
        })
    }
})

// 发送到服务器
async function saveToLocalServer(data: {
    content: string
    title: string
    source_url: string
    source_type: string
}): Promise<boolean> {
    const serverUrl = await getServerUrl()

    try {
        const response = await fetch(`${serverUrl}/api/ingest`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })

        if (response.ok) {
            // 发送通知
            chrome.notifications?.create({
                type: "basic",
                iconUrl: chrome.runtime.getURL("assets/icon.png"),
                title: "第二大脑",
                message: "内容已保存到知识库",
            })
        }

        return response.ok
    } catch (error) {
        console.error("保存失败:", error)
        chrome.notifications?.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("assets/icon.png"),
            title: "第二大脑",
            message: "保存失败，请检查服务器是否运行",
        })
        return false
    }
}

// 获取服务器地址
async function getServerUrl(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["serverUrl"], (result) => {
            resolve(result.serverUrl || "https://x.saaaai.com")
        })
    })
}

// 检查服务器健康状态
export async function checkServerHealth(): Promise<{
    online: boolean
    ollama: boolean
}> {
    const serverUrl = await getServerUrl()

    try {
        const response = await fetch(`${serverUrl}/api/health`, {
            method: "GET",
            signal: AbortSignal.timeout(3000),
        })

        if (!response.ok) {
            return { online: false, ollama: false }
        }

        const data = await response.json()
        return {
            online: true,
            ollama: data.components?.ollama?.online ?? false,
        }
    } catch (error) {
        return { online: false, ollama: false }
    }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CHECK_HEALTH") {
        checkServerHealth().then(sendResponse)
        return true // 保持消息通道开放
    }

    if (message.type === "SAVE_CONTENT") {
        saveToLocalServer(message.data).then(sendResponse)
        return true
    }
})

export { }
