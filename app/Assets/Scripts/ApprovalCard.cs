// ApprovalCard.cs — the world-space approval card, rendered only in the
// wearer's glasses. Amount, purpose, tier, and the result afterwards.
using UnityEngine;
using TMPro;

public class ApprovalCard : MonoBehaviour
{
    public TMP_Text titleText;
    public TMP_Text amountText;
    public TMP_Text purposeText;
    public TMP_Text tierText;
    public TMP_Text resultText;

    public void Show(string id, string amount, string purpose, string tier)
    {
        gameObject.SetActive(true);
        // Brand voice (brand/voice-and-tone.md): ELI5 tier names, never engine words.
        titleText.text = "Your agent asks to spend";
        amountText.text = FormatAmount(amount);
        purposeText.text = purpose;
        tierText.text = tier switch
        {
            "auto" => "an everyday spend",
            "motion" => "this one is your call",
            "worldid" => "a bigger decision",
            _ => tier,
        };
        resultText.text = "";
    }

    public void ShowResult(string txHash, bool settled)
    {
        if (!gameObject.activeSelf) return;
        // No tx hash on the glasses (glasses-ui.md §5): the wearer gets the
        // outcome in words; the receipt lives in the episode log.
        resultText.text = settled
            ? "Approved. The receipt is in your records."
            : "Denied. No money moved.";
        // fade the card after a few seconds
        Invoke(nameof(Hide), 6f);
    }

    private void Hide() => gameObject.SetActive(false);

    private static string FormatAmount(string baseUnits)
    {
        if (long.TryParse(baseUnits, out var v))
            return $"${v / 1_000_000.0:F2}";
        return baseUnits;
    }
}
