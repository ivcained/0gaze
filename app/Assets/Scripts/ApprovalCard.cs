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
        titleText.text = "PAYMENT APPROVAL";
        amountText.text = FormatAmount(amount);
        purposeText.text = purpose;
        tierText.text = tier switch
        {
            "auto" => "auto (below floor)",
            "motion" => "motion gate required",
            "worldid" => "World ID required",
            _ => tier,
        };
        resultText.text = "";
    }

    public void ShowResult(string txHash, bool settled)
    {
        if (!gameObject.activeSelf) return;
        resultText.text = settled
            ? $"settled: {txHash[..10]}…{txHash[^4..]}"
            : "denied";
        // fade the card after a few seconds
        Invoke(nameof(Hide), 6f);
    }

    private void Hide() => gameObject.SetActive(false);

    private static string FormatAmount(string baseUnits)
    {
        if (long.TryParse(baseUnits, out var v))
            return $"{v / 1_000_000.0:F2} USDT";
        return baseUnits;
    }
}
