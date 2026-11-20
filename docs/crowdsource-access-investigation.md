# Crowdsource Access Investigation Report

**Project:** LocalLens (Startup Buildathon India 2026)  
**Assigned Developer:** Developer C — Maps Platform, Grounding, Routes & Crowd Management  
**Task Focus:** Crowdsource Access Investigation  
**Date:** November 20, 2026  

---

## 1. Objective

Investigate programmatic access to **Google Crowdsource** for extracting regional dialect, cultural terminology, and community place signals to ground voice-based spot recommendations and neighborhood itineraries.

---

## 2. Investigation Findings

1. **Absence of Public Developer REST API:**
   - Google Crowdsource is a community gamified contribution platform operated by Google to collect training data (handwriting, image labels, translation validation, sentiment, voice samples).
   - Google does **not** provide a public developer API, SDK, or OAuth client for third-party applications to query Crowdsource submissions directly in real time.
2. **Data Availability in Open Datasets:**
   - Aggregated Crowdsource contributions are periodically released via Google Research open datasets (e.g. Crowdsourced Multimodal Datasets on HuggingFace/Kaggle), but these are static research releases rather than a live operational backend.

---

## 3. Recommended Architectural Integration for LocalLens

To fulfill the pitch deck commitment ("Grounding with Google Crowdsource community dialect/place signals") without inventing APIs:

1. **LocalLens Insider Voice Ingestion (Primary Source):**
   - Everyday local residents record 2-minute regional voice memos and photos directly in the LocalLens app.
   - Developer B's AI pipeline (Gemini 3.8 Flash + Gemini 3.8 Live) extracts regional dialect terms (e.g. *Benne Dosa*, *Thindi Beedi*, *Darshini*, *Pete*) from actual insider submissions.
2. **Google Search Grounding (Live Cultural & Regional Context):**
   - Uses Gemini Search Grounding (`googleSearch`) to verify local dialect terms, regional culinary naming conventions, and cultural festivals.
3. **Google Places Reviews (Sentiment & Dialect Grounding):**
   - Google Places API (New) review snippets and editorial summaries are processed for regional keywords and sentiment signals.
4. **Pre-curated Regional Dialect Dictionary:**
   - Curated community dialect mappings (Kannada/regional terms mapped to standard dietary/cultural tags) stored in Firestore to enrich spot cards offline and online.

> [!NOTE]
> **Conclusion:** Google Crowdsource API is recorded as **unavailable as a direct live API**. The pipeline achieves identical semantic grounding through direct insider voice notes, Google Search grounding, and Maps review sentiment.
