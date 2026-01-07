import type { PlasmoCSConfig } from "plasmo"

// 配置内容脚本运行范围
export const config: PlasmoCSConfig = {
    matches: ["https://twitter.com/*", "https://x.com/*"],
    all_frames: false,
}

// 提取推文数据的接口
interface TweetData {
    id: string
    author: string
    authorHandle: string
    content: string
    timestamp: string
    likes: number
    retweets: number
    replies: number
    url: string
    images: string[]
    videoPoster?: string
    comments?: string[]
}

// 广告检测关键词
const AD_KEYWORDS = ['Promoted', '推荐', '广告', 'Ad', 'Sponsored']

// 检查是否为广告推文
function isAdTweet(element: Element): boolean {
    const textContent = element.textContent || ''
    for (const keyword of AD_KEYWORDS) {
        if (textContent.includes(keyword)) {
            const spans = Array.from(element.querySelectorAll('span'))
            const isAd = spans.some(s => AD_KEYWORDS.includes(s.textContent?.trim() || ''))
            if (isAd) return true
        }
    }
    const adLabel = element.querySelector('[data-testid="promotedIndicator"]')
    if (adLabel) return true
    return false
}

// 等待指定时间
function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 展开折叠的推文内容（只在推文区域内操作）
async function expandCollapsedContent(): Promise<void> {
    // 只在推文时间线区域内查找，避免触发侧边栏
    const timeline = document.querySelector('[data-testid="primaryColumn"]')
    if (!timeline) return

    // 查找"显示更多"链接（用于展开长文本）
    const showMoreLinks = timeline.querySelectorAll('[data-testid="tweet"] span')
    showMoreLinks.forEach(span => {
        const text = span.textContent || ''
        if (text === '显示更多' || text === 'Show more' || text === '展开') {
            const clickableParent = span.closest('[role="button"]') || span.closest('a') || span
            if (clickableParent) {
                console.log('展开折叠内容...')
                    ; (clickableParent as HTMLElement).click()
            }
        }
    })

    // 只点击推文内的"显示此线程"按钮，排除侧边栏
    const tweetButtons = timeline.querySelectorAll('[data-testid="tweet"] [role="button"]')
    tweetButtons.forEach(btn => {
        const text = btn.textContent || ''
        if (text.includes('显示此线程') || text.includes('Show this thread')) {
            console.log('展开线程...')
                ; (btn as HTMLElement).click()
        }
    })

    await wait(300)
}

// 从单个推文元素提取评论内容（包含图片）
function extractCommentFromTweet(tweet: Element, seenTexts: Set<string>): string | null {
    if (isAdTweet(tweet)) return null

    const authorElement = tweet.querySelector('[data-testid="User-Name"]')
    const author = authorElement?.textContent || ''
    const textElement = tweet.querySelector('[data-testid="tweetText"]')

    // 提取文本并保留换行结构
    let text = ''
    if (textElement) {
        const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
        let node: Node | null
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent
            } else if (node.nodeName === 'BR' || node.nodeName === 'DIV') {
                text += '\n'
            }
        }
        if (!text.trim()) {
            text = textElement.textContent || ''
        }
    }

    // 提取评论中的图片
    const images: string[] = []
    const imageElements = tweet.querySelectorAll('[data-testid="tweetPhoto"] img')
    imageElements.forEach(img => {
        const src = img.getAttribute('src')
        if (src && !src.includes('profile_images') && !src.includes('emoji')) {
            let hdSrc = src
            if (src.includes('format=')) {
                hdSrc = src.replace(/name=\w+/, 'name=large')
            }
            images.push(hdSrc)
        }
    })

    // 检查是否有视频
    let videoInfo = ''
    const video = tweet.querySelector('video')
    if (video) {
        const poster = video.getAttribute('poster')
        if (poster) {
            videoInfo = '\n\n  📹 [点击查看视频]'
            images.push(poster)
        }
    }

    if (!text.trim() && images.length === 0) return null

    const cleanText = text.replace(/\n{3,}/g, '\n\n').trim()
    const commentKey = `${cleanText.substring(0, 50)}|${images.length}`
    if (seenTexts.has(commentKey)) return null
    seenTexts.add(commentKey)

    const authorFormatted = author.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    const handleMatch = authorFormatted.match(/@\w+/)
    const handle = handleMatch ? handleMatch[0] : ''
    const displayName = authorFormatted.split('@')[0].trim()

    let comment = `**${displayName}** ${handle}

${cleanText}${videoInfo}`

    if (images.length > 0) {
        comment += '\n\n' + images.map(img => `![](${img})`).join('\n')
    }

    return comment
}

// 边滚动边提取评论 - 只在主列区域内操作
async function scrollAndExtractComments(targetCount: number = 30): Promise<string[]> {
    const comments: string[] = []
    const seenTexts = new Set<string>()

    if (!window.location.href.includes('/status/')) {
        console.log('不在推文详情页，跳过评论提取')
        return comments
    }

    console.log(`开始滚动并提取评论，目标: ${targetCount} 条`)

    await expandCollapsedContent()

    const extractCurrentComments = async () => {
        await expandCollapsedContent()

        const allTweets = document.querySelectorAll('[data-testid="tweet"]')
        let extracted = 0
        for (let i = 1; i < allTweets.length && comments.length < targetCount; i++) {
            const comment = extractCommentFromTweet(allTweets[i], seenTexts)
            if (comment) {
                comments.push(comment)
                extracted++
            }
        }
        return extracted
    }

    await extractCurrentComments()
    console.log(`初始提取: ${comments.length} 条评论`)

    let stableRounds = 0
    const maxRounds = 30
    let lastCommentCount = comments.length

    // 获取主内容列，只在这里面操作
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]')

    for (let round = 0; round < maxRounds && comments.length < targetCount; round++) {
        window.scrollBy({ top: window.innerHeight * 1.5, behavior: 'smooth' })
        await wait(800)

        // 只点击推文区域内的"显示更多回复"按钮
        // 使用更精确的选择器，排除侧边栏
        if (primaryColumn) {
            const replyButtons = primaryColumn.querySelectorAll('[data-testid="cellInnerDiv"] [role="button"]')
            replyButtons.forEach(btn => {
                const text = btn.textContent || ''
                // 更精确的匹配：只匹配"显示更多回复"或"Show more replies"
                if (
                    (text.includes('显示') && text.includes('回复')) ||
                    (text.includes('Show') && text.includes('repl'))
                ) {
                    console.log('点击"显示更多回复"按钮')
                        ; (btn as HTMLElement).click()
                }
            })
        }

        await wait(400)

        const newExtracted = await extractCurrentComments()
        console.log(`滚动 ${round + 1}/${maxRounds}, 已提取: ${comments.length} 条评论 (+${newExtracted})`)

        const isAtBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 100)

        if (comments.length > 0) {
            if (comments.length === lastCommentCount) {
                stableRounds++
                const requiredStableRounds = isAtBottom ? 2 : 5
                if (stableRounds >= requiredStableRounds) {
                    console.log(`连续${stableRounds}轮无新评论，停止滚动`)
                    break
                }
            } else {
                stableRounds = 0
            }
        } else {
            if (isAtBottom) {
                stableRounds++
                if (stableRounds >= 3) {
                    console.log('已到页面底部且无评论，停止滚动')
                    break
                }
            }
        }
        lastCommentCount = comments.length
    }

    window.scrollTo({ top: 0, behavior: 'instant' })
    console.log(`提取完成，共 ${comments.length} 条评论`)
    return comments
}

// 从推文元素提取数据（不含评论）
function extractBaseTweetData(tweetElement: Element): TweetData | null {
    try {
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]') as HTMLAnchorElement
        if (!tweetLink) return null

        const url = tweetLink.href
        const idMatch = url.match(/status\/(\d+)/)
        const id = idMatch ? idMatch[1] : ''

        const authorElement = tweetElement.querySelector('[data-testid="User-Name"]')
        const authorName = authorElement?.querySelector('span')?.textContent || 'Unknown'
        const handleElement = authorElement?.querySelectorAll('span')
        let authorHandle = ''
        handleElement?.forEach(span => {
            if (span.textContent?.startsWith('@')) {
                authorHandle = span.textContent
            }
        })

        const contentElement = tweetElement.querySelector('[data-testid="tweetText"]')
        const content = contentElement?.textContent || ''

        const timeElement = tweetElement.querySelector('time')
        const timestamp = timeElement?.getAttribute('datetime') || ''

        const getMetricValue = (testId: string): number => {
            const element = tweetElement.querySelector(`[data-testid="${testId}"]`)
            const text = element?.textContent || '0'
            const num = parseInt(text.replace(/[^\d]/g, ''))
            return isNaN(num) ? 0 : num
        }

        const likes = getMetricValue('like')
        const retweets = getMetricValue('retweet')
        const replies = getMetricValue('reply')

        const images: string[] = []
        const imageElements = tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img')
        imageElements.forEach(img => {
            const src = img.getAttribute('src')
            if (src && !src.includes('profile_images')) {
                let hdSrc = src
                if (src.includes('format=')) {
                    hdSrc = src.replace(/name=\w+/, 'name=large')
                }
                images.push(hdSrc)
            }
        })

        let videoPoster: string | undefined
        const videoElement = tweetElement.querySelector('video')
        if (videoElement) {
            videoPoster = videoElement.getAttribute('poster') || undefined
        } else {
            const posterImg = tweetElement.querySelector('[data-testid="videoPlayer"] img')
            if (posterImg) videoPoster = posterImg.getAttribute('src') || undefined
        }

        let quotedContent = ''
        try {
            const allLinks = Array.from(tweetElement.querySelectorAll('div[role="link"], a[role="link"]'))
            const quotedTweet = allLinks.find(el => {
                return el.querySelector('[data-testid="User-Name"]') &&
                    el !== tweetElement &&
                    !el.closest('[data-testid="User-Name"]')
            })

            if (quotedTweet) {
                const qAuthor = quotedTweet.querySelector('[data-testid="User-Name"]')?.textContent || 'Unknown'
                const qText = quotedTweet.querySelector('[data-testid="tweetText"]')?.textContent || ''
                if (qAuthor || qText) {
                    quotedContent = `\n\n> **引用 @${qAuthor}:**\n> ${qText.replace(/\n/g, '\n> ')}`
                }
            }
        } catch (e) {
            console.log('提取引用推文失败', e)
        }

        return {
            id,
            author: authorName,
            authorHandle,
            content: content + quotedContent,
            timestamp,
            likes,
            retweets,
            replies,
            url,
            images,
            videoPoster,
            comments: []
        }
    } catch (error) {
        console.error('提取推文数据失败:', error)
        return null
    }
}

// 从推文元素提取完整数据（含自动滚动加载评论）
async function extractTweetDataWithComments(tweetElement: Element): Promise<TweetData | null> {
    const tweetData = extractBaseTweetData(tweetElement)
    if (!tweetData) return null

    tweetData.comments = await scrollAndExtractComments(30)

    return tweetData
}

// 创建圆形保存按钮（匹配 Grok 按钮样式）
function createSaveButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'secondbrain-save-btn'
    button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  `
    button.title = '保存到第二大脑'
    button.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
    background: rgb(32, 35, 39);
    color: rgb(29, 155, 240);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  `

    button.onmouseover = () => {
        button.style.background = 'rgba(29, 155, 240, 0.1)'
        button.style.transform = 'scale(1.1)'
    }
    button.onmouseout = () => {
        button.style.background = 'rgb(32, 35, 39)'
        button.style.transform = 'scale(1)'
    }

    return button
}

// 发送到服务器
async function sendToLocalServer(tweet: TweetData): Promise<boolean> {
    const serverUrl = await getServerUrl()

    let mediaSection = ''
    if (tweet.images.length > 0 || tweet.videoPoster) {
        mediaSection = '\n\n---\n'
        if (tweet.images.length > 0) {
            mediaSection += '\n' + tweet.images.map(img => `![](${img})`).join('\n')
        }
        if (tweet.videoPoster) {
            mediaSection += `\n\n[![📹 点击查看视频](${tweet.videoPoster})](${tweet.url})`
        }
    }

    let commentsSection = ''
    if (tweet.comments && tweet.comments.length > 0) {
        const numberedComments = tweet.comments.map((comment, index) => {
            return `### ${index + 1}.

${comment}`
        })
        commentsSection = `\n\n---\n\n## 评论区 (${tweet.comments.length}条)\n${numberedComments.join('\n\n')}`
    }

    const content = `
# ${tweet.author} (${tweet.authorHandle})

${tweet.content}
${mediaSection}
${commentsSection}

---

**来源:** ${tweet.url}
**发布时间:** ${new Date(tweet.timestamp).toLocaleString('zh-CN')}
`.trim()

    try {
        const response = await fetch(`${serverUrl}/api/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                title: `Twitter: ${tweet.author} - ${tweet.content.substring(0, 50)}...`,
                source_url: tweet.url,
                source_type: 'twitter',
            }),
        })
        return response.ok
    } catch (error) {
        console.error('发送到服务器失败:', error)
        return false
    }
}

// 获取服务器地址（带错误处理）
async function getServerUrl(): Promise<string> {
    const defaultUrl = 'https://x.saaaai.com'
    try {
        // 检查 chrome 和 chrome.storage 是否可用
        if (typeof chrome === 'undefined' || !chrome || !chrome.storage || !chrome.storage.sync) {
            console.log('Chrome storage not available, using default URL')
            return defaultUrl
        }
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get(['serverUrl'], (result) => {
                    if (chrome.runtime?.lastError) {
                        console.log('Storage error:', chrome.runtime.lastError)
                        resolve(defaultUrl)
                        return
                    }
                    resolve(result?.serverUrl || defaultUrl)
                })
            } catch (e) {
                console.log('Storage access error:', e)
                resolve(defaultUrl)
            }
        })
    } catch (e) {
        console.log('Extension context error:', e)
        return defaultUrl
    }
}

// 检查是否是主推文
function isMainTweet(tweetElement: Element): boolean {
    if (!window.location.href.includes('/status/')) {
        return true
    }
    const allTweets = document.querySelectorAll('[data-testid="tweet"]')
    return allTweets.length > 0 && allTweets[0] === tweetElement
}

// 注入保存按钮到 Grok 按钮左侧
function injectSaveButtons(): void {
    const tweets = document.querySelectorAll('[data-testid="tweet"]')

    tweets.forEach(tweet => {
        if (tweet.querySelector('.secondbrain-save-btn')) return
        if (!isMainTweet(tweet)) return

        const tweetArticle = tweet.closest('article') || tweet

        // 查找右上角的按钮区域（包含三点菜单）
        const caret = tweetArticle.querySelector('[data-testid="caret"]')
        if (caret) {
            // 找到 caret 的 button 父元素
            const caretButton = caret.closest('button') || caret.closest('[role="button"]')
            if (caretButton) {
                // 找到包含所有右侧按钮的容器
                const buttonsContainer = caretButton.parentElement
                if (buttonsContainer && !buttonsContainer.querySelector('.secondbrain-save-btn')) {
                    // 确保容器是 flex 横向排列
                    const containerStyle = window.getComputedStyle(buttonsContainer)
                    if (containerStyle.display !== 'flex') {
                        (buttonsContainer as HTMLElement).style.display = 'flex'
                            (buttonsContainer as HTMLElement).style.alignItems = 'center'
                                (buttonsContainer as HTMLElement).style.gap = '4px'
                    }

                    const saveButton = createSaveButton()
                    saveButton.onclick = async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleSaveClick(saveButton, tweet)
                    }

                    // 插入到容器最前面（Grok/caret 按钮左边）
                    buttonsContainer.insertBefore(saveButton, buttonsContainer.firstChild)
                    return
                }
            }
        }
    })
}

// 处理保存按钮点击
async function handleSaveClick(saveButton: HTMLButtonElement, tweet: Element): Promise<void> {
    const originalContent = saveButton.innerHTML
    saveButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
        </svg>
    `
    saveButton.style.color = '#fbbf24'
    saveButton.style.pointerEvents = 'none'

    const style = document.createElement('style')
    style.id = 'secondbrain-spin-style'
    if (!document.getElementById('secondbrain-spin-style')) {
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .animate-spin { animation: spin 1s linear infinite; }
        `
        document.head.appendChild(style)
    }

    const tweetData = await extractTweetDataWithComments(tweet)

    if (!tweetData) {
        saveButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
        `
        saveButton.style.color = '#ef4444'
        saveButton.title = '提取失败'
        setTimeout(() => {
            saveButton.innerHTML = originalContent
            saveButton.style.color = 'rgb(29, 155, 240)'
            saveButton.style.pointerEvents = 'auto'
            saveButton.title = '保存到第二大脑'
        }, 2000)
        return
    }

    const success = await sendToLocalServer(tweetData)

    if (success) {
        saveButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `
        saveButton.style.color = '#22c55e'
        saveButton.title = `已保存 (${tweetData.comments?.length || 0}条评论)`

        setTimeout(() => {
            saveButton.innerHTML = originalContent
            saveButton.style.color = 'rgb(29, 155, 240)'
            saveButton.style.pointerEvents = 'auto'
            saveButton.title = '保存到第二大脑'
        }, 3000)
    } else {
        saveButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        `
        saveButton.style.color = '#ef4444'
        saveButton.title = '保存失败，请检查服务器连接'

        setTimeout(() => {
            saveButton.innerHTML = originalContent
            saveButton.style.color = 'rgb(29, 155, 240)'
            saveButton.style.pointerEvents = 'auto'
            saveButton.title = '保存到第二大脑'
        }, 3000)
    }
}

// 使用 MutationObserver 监听新推文
function observeTweets(): void {
    const observer = new MutationObserver(() => {
        injectSaveButtons()
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    })

    injectSaveButtons()
}

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeTweets)
} else {
    observeTweets()
}

console.log('🧠 第二大脑 Twitter Content Script loaded')
