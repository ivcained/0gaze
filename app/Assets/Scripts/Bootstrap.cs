// Bootstrap.cs — builds the whole app at runtime. The scene is intentionally
// almost empty: one camera, one Bootstrap. Everything else (canvas, texts,
// PayClient, MotionGate) is constructed here so no hand-authored scene
// references can rot.
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class Bootstrap : MonoBehaviour
{
    [Tooltip("The agent's WebSocket. On the bench: ws://<mac-ip>:7602")]
    public string agentUrl = "ws://127.0.0.1:7602";

    void Awake()
    {
        // EventSystem for UI input
        var es = new GameObject("EventSystem", typeof(UnityEngine.EventSystems.EventSystem), typeof(UnityEngine.EventSystems.StandaloneInputModule));

        // World-space canvas, in front of the camera
        var canvasGo = new GameObject("ApprovalCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = canvasGo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        var rt = canvas.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(800, 500);
        rt.position = new Vector3(0, 0, 1.2f); // 1.2m in front of the head

        // Card background panel
        var panel = CreatePanel(canvasGo.transform, new Color(0.05f, 0.05f, 0.05f, 0.85f));

        var title = CreateText(panel.transform, "Title", "PAYMENT APPROVAL", 36, new Vector2(0, 180), new Color(0.83f, 1f, 0.25f));
        var amount = CreateText(panel.transform, "Amount", "", 64, new Vector2(0, 90), Color.white);
        var purpose = CreateText(panel.transform, "Purpose", "", 28, new Vector2(0, 20), new Color(0.9f, 0.9f, 0.9f));
        var tier = CreateText(panel.transform, "Tier", "", 24, new Vector2(0, -30), new Color(0.7f, 0.7f, 0.7f));
        var result = CreateText(panel.transform, "Result", "", 22, new Vector2(0, -120), new Color(0.5f, 1f, 0.5f));

        // ApprovalCard
        var card = canvasGo.AddComponent<ApprovalCard>();
        card.titleText = title;
        card.amountText = amount;
        card.purposeText = purpose;
        card.tierText = tier;
        card.resultText = result;
        canvasGo.SetActive(false); // hidden until a request arrives

        // MotionGate
        var gateGo = new GameObject("MotionGate");
        var gate = gateGo.AddComponent<MotionGate>();

        // PayClient
        var clientGo = new GameObject("PayClient");
        var client = clientGo.AddComponent<PayClient>();
        client.agentUrl = agentUrl;
        client.card = card;
        client.motionGate = gate;

        Debug.Log("[EyesOnly] bootstrapped. Waiting for approval requests…");
    }

    private GameObject CreatePanel(Transform parent, Color color)
    {
        var go = new GameObject("Panel", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        go.transform.SetParent(parent, false);
        var img = go.GetComponent<Image>();
        img.color = color;
        var rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(760, 460);
        return go;
    }

    private TMP_Text CreateText(Transform parent, string name, string text, int size, Vector2 pos, Color color)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(TextMeshProUGUI));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(700, size + 20);
        rt.anchoredPosition = pos;
        var tmp = go.GetComponent<TextMeshProUGUI>();
        tmp.text = text;
        tmp.fontSize = size;
        tmp.color = color;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.enableWordWrapping = true;
        return tmp;
    }
}
