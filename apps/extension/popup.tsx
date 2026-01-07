import { useEffect, useState } from "react"

interface HealthStatus {
  online: boolean
  ollama: boolean
}

function IndexPopup() {
  const [serverUrl, setServerUrl] = useState("https://x.saaaai.com")
  const [health, setHealth] = useState<HealthStatus>({ online: false, ollama: false })
  const [checking, setChecking] = useState(true)
  const [saved, setSaved] = useState(false)

  // 加载保存的设置
  useEffect(() => {
    chrome.storage.sync.get(["serverUrl"], (result) => {
      if (result.serverUrl) {
        setServerUrl(result.serverUrl)
      }
    })
    checkHealth()
  }, [])

  // 检查服务器健康状态
  const checkHealth = async () => {
    setChecking(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: "CHECK_HEALTH" })
      setHealth(response)
    } catch (error) {
      setHealth({ online: false, ollama: false })
    }
    setChecking(false)
  }

  // 保存设置
  const saveSettings = () => {
    chrome.storage.sync.set({ serverUrl }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      checkHealth()
    })
  }

  return (
    <div
      style={{
        width: 320,
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        color: "#f1f5f9",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          🧠
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>第二大脑</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>云端AI知识库</p>
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>状态</div>
        <div style={{ display: "flex", gap: 16 }}>
          <StatusBadge
            label="服务器"
            online={health.online}
            checking={checking}
          />
          <StatusBadge
            label="AI"
            online={health.ollama}
            checking={checking}
          />
        </div>
        <button
          onClick={checkHealth}
          disabled={checking}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "8px 12px",
            background: "rgba(99, 102, 241, 0.2)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: 8,
            color: "#818cf8",
            fontSize: 13,
            cursor: checking ? "wait" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {checking ? "检查中..." : "刷新状态"}
        </button>
      </div>

      {/* Settings */}
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>设置</div>
        <label style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 4, display: "block" }}>
          服务器地址
        </label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://x.saaaai.com"
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={saveSettings}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px 12px",
            background: saved
              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            border: "none",
            borderRadius: 8,
            color: "white",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {saved ? "✓ 已保存" : "保存设置"}
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          fontSize: 11,
          color: "#64748b",
          textAlign: "center",
        }}
      >
        在 Twitter 上点击圆形保存按钮将内容保存到知识库
      </div>
    </div>
  )
}

// 状态徽章组件
function StatusBadge({
  label,
  online,
  checking,
}: {
  label: string
  online: boolean
  checking: boolean
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: checking
            ? "#fbbf24"
            : online
              ? "#22c55e"
              : "#ef4444",
          boxShadow: checking
            ? "0 0 8px #fbbf24"
            : online
              ? "0 0 8px #22c55e"
              : "0 0 8px #ef4444",
        }}
      />
      <span style={{ fontSize: 13, color: "#e2e8f0" }}>{label}</span>
    </div>
  )
}

export default IndexPopup
