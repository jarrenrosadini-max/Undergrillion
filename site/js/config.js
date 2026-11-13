// Flip ADS_ENABLED to true once an ad network is approved (Phase 4).
// Slots: banner-top, results-box, rail-left, rail-right, interstitial.
export const CONFIG = {
  ADS_ENABLED: false,
  INTERSTITIAL_EVERY: 10,      // Open Mic prompts between interstitial slots
  DAILY_SECONDS: 25,
  ATTEMPTS: 3,
  OPEN_MIC_FAN_RATE: 0.5,
};
