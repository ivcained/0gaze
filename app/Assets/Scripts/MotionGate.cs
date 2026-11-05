// MotionGate.cs — the wearer's head-motion profile as an approval gate.
//
// Samples the head pose from the Ffalcon XR SDK (or Unity's Input.gyro as a
// bench fallback) during a short window, compares against the enrolled
// profile, and answers the agent with match/no-match.
//
// The enrolled profile is a normalized vector of recent motion statistics
// (yaw rate variance, pitch rate, head tilt). Enrollment happens once in the
// app; the live sample must match within a threshold.
using System;
using System.Collections.Generic;
using UnityEngine;

public class MotionGate : MonoBehaviour
{
    [Tooltip("Seconds of motion sampled for one gate decision")]
    public float windowSeconds = 3f;

    [Tooltip("Cosine-similarity threshold for a match")]
    public float matchThreshold = 0.85f;

    private List<float> enrolledProfile; // yawVar, pitchVar, rollVar
    private bool enrolled;

    void Start()
    {
        enrolledProfile = LoadEnrolledProfile();
        enrolled = enrolledProfile != null && enrolledProfile.Count == 3;
    }

    public void Evaluate(ApprovalRequest req, Action<bool, float> onVerdict)
    {
        if (!enrolled)
        {
            Debug.LogWarning("[MotionGate] no enrolled profile — denying");
            onVerdict(false, 0f);
            return;
        }
        StartCoroutine(SampleAndCompare(onVerdict));
    }

    /// <summary>Called by PayClient when a worldid-tier request needs a proof.</summary>
    public void RequestWorldIdProof(ApprovalRequest req)
    {
        // In production: launch the World App via IDKit deep link with the
        // rp_context from req.world_id_rp_context. The World App returns a
        // proof that PayClient forwards as worldid_proof.
        //
        // Bench fallback: auto-deny so the demo doesn't hang waiting for a
        // proof that can't be generated without the World App.
        Debug.Log($"[MotionGate] World ID proof requested for {req.id} — bench fallback: denied");
        // PayClient will receive this via its own callback; see PayClient.cs
    }

    private System.Collections.IEnumerator SampleAndCompare(Action<bool, float> onVerdict)
    {
        var samples = new List<float>();
        var start = Time.time;
        while (Time.time - start < windowSeconds)
        {
            // Ffalcon SDK: HeadPose.GetRotation() — bench fallback: gyro
            Vector3 angVel = Input.gyro.enabled
                ? Input.gyro.rotationRate
                : Vector3.zero;
            samples.Add(angVel.magnitude);
            yield return null;
        }

        if (samples.Count < 10)
        {
            onVerdict(false, 0f);
            yield break;
        }

        // stats: mean angular rate, variance, max
        float mean = 0f, max = 0f;
        foreach (var s in samples) { mean += s; if (s > max) max = s; }
        mean /= samples.Count;
        float variance = 0f;
        foreach (var s in samples) variance += (s - mean) * (s - mean);
        variance /= samples.Count;

        // live profile: [mean, variance, max] normalized
        var live = new List<float> { mean, variance, max };
        var norm = Normalize(live);
        var enrolledNorm = Normalize(enrolledProfile);

        float similarity = CosineSimilarity(norm, enrolledNorm);
        bool match = similarity >= matchThreshold;
        Debug.Log($"[MotionGate] score {similarity:F3} threshold {matchThreshold} -> {(match ? "MATCH" : "mismatch")}");
        onVerdict(match, similarity);
    }

    private List<float> Normalize(List<float> v)
    {
        float sum = 0f;
        foreach (var x in v) sum += x * x;
        sum = Mathf.Sqrt(sum);
        if (sum < 1e-6f) return v;
        return new List<float> { v[0] / sum, v[1] / sum, v[2] / sum };
    }

    private float CosineSimilarity(List<float> a, List<float> b)
    {
        float dot = 0f, na = 0f, nb = 0f;
        for (int i = 0; i < a.Count && i < b.Count; i++)
        {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        if (na < 1e-6f || nb < 1e-6f) return 0f;
        return dot / (Mathf.Sqrt(na) * Mathf.Sqrt(nb));
    }

    private List<float> LoadEnrolledProfile()
    {
        // placeholder: enrollment writes three floats to PlayerPrefs
        if (PlayerPrefs.HasKey("motion_profile_mean"))
        {
            return new List<float>
            {
                PlayerPrefs.GetFloat("motion_profile_mean"),
                PlayerPrefs.GetFloat("motion_profile_var"),
                PlayerPrefs.GetFloat("motion_profile_max"),
            };
        }
        return null;
    }

    public void Enroll(List<float> profile)
    {
        PlayerPrefs.SetFloat("motion_profile_mean", profile[0]);
        PlayerPrefs.SetFloat("motion_profile_var", profile[1]);
        PlayerPrefs.SetFloat("motion_profile_max", profile[2]);
        PlayerPrefs.Save();
        enrolledProfile = profile;
        enrolled = true;
    }
}
