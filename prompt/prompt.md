设计一个 Ros 连接状态机，用于表达 SDK 与 ROS 系统的通信可用性（不是 WebSocket 技术状态）。
状态包括：IDLE（未连接/切换URL后）、CONNECTING（正在连接）、CONNECTED（可通信）、RECONNECTING（断线自动重连）、CLOSED（主动关闭，不重连）、ERROR（不可恢复）。
状态只能由 Ros 连接生命周期事件修改，Topic/Service 不得修改状态。
状态转移规则：
IDLE -> CONNECTING（connect）
CONNECTING -> CONNECTED（onopen）
CONNECTING -> RECONNECTING（onerror/onclose）
CONNECTED -> RECONNECTING（非主动断线）
CONNECTED -> CLOSED（disconnect）
RECONNECTING -> CONNECTED（重连成功）
RECONNECTING -> ERROR（超出重试）
ANY -> IDLE（switchUrl）

