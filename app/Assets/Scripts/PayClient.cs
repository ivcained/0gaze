// PayClient.cs — the phone's side of the approval handshake.
//
// Connects to the agent over WebSocket, receives approval_request, shows the
// card to the wearer (glasses only), runs the motion gate, and answers with
// verdicts. Signing itself happens on the Dabao chip; the agent reports the
// result back as sign_result.
//
// Message shapes (JSON):
//   in  approval_request { id, amount, token, chain, purpose, tier }
//   in  sign_result      { id, signature, txHash, settled }
//   out motion_verdict   { id, match, score }
//   out worldid_verdict  { id, status }
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

public class PayClient : MonoBehaviour
{
    [Tooltip("The agent's WebSocket. On the bench: ws://<mac-ip>:7602")]
    public string agentUrl = "ws://127.0.0.1:7602";

    public ApprovalCard card;
    public MotionGate motionGate;

    private ClientWebSocket ws;
    private readonly System.Collections.Concurrent.ConcurrentQueue<Action> mainThread = new();

    async void Start()
    {
        try
        {
            var uri = new Uri(agentUrl);
            ws = new ClientWebSocket();
            await ws.ConnectAsync(uri, CancellationToken.None);
            Debug.Log("[PayClient] connected to agent");
            _ = ReceiveLoop();
        }
        catch (Exception e)
        {
            Debug.LogError($"[PayClient] connect failed: {e.Message}");
        }
    }

    private async Task ReceiveLoop()
    {
        var buffer = new byte[8192];
        while (ws != null && ws.State == WebSocketState.Open)
        {
            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            if (result.MessageType == WebSocketMessageType.Close) break;
            var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
            mainThread.Enqueue(() => HandleMessage(json));
        }
        Debug.Log("[PayClient] disconnected");
    }

    private void HandleMessage(string json)
    {
        var msg = JsonUtility.FromJson<ApprovalRequest>(json);
        if (msg == null) return;
        switch (msg.type)
        {
            case "approval_request":
                ShowApproval(msg);
                break;
            case "sign_result":
                var sr = JsonUtility.FromJson<SignResult>(json);
                card.ShowResult(sr.txHash, sr.settled);
                break;
        }
    }

    private void ShowApproval(ApprovalRequest req)
    {
        card.Show(req.id, req.amount, req.purpose, req.tier);
        // The motion gate runs on the head pose stream; verdict goes back to the agent.
        motionGate.Evaluate(req, (match, score) =>
        {
            Send($"{{\"type\":\"motion_verdict\",\"id\":\"{req.id}\",\"match\":{(match ? "true" : "false")},\"score\":{score:0.00}}}");
        });
    }

    private void Send(string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        _ = ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    void Update()
    {
        while (mainThread.TryDequeue(out var action)) action();
    }

    void OnDestroy()
    {
        ws?.Abort();
    }
}

[Serializable]
public class ApprovalRequest
{
    public string type;
    public string id;
    public string amount;
    public string token;
    public string chain;
    public string purpose;
    public string tier;
}

[Serializable]
public class SignResult
{
    public string type;
    public string id;
    public string signature;
    public string txHash;
    public bool settled;
}
