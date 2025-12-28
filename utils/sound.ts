// export const playSuccessSound = () => {
//   const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
//   if (!AudioContext) return;

//   const ctx = new AudioContext();
//   const osc = ctx.createOscillator();
//   const gain = ctx.createGain();

//   osc.connect(gain);
//   gain.connect(ctx.destination);

//   // Hard success beep
//   osc.type = 'square'; // sharper than sine
//   osc.frequency.setValueAtTime(1200, ctx.currentTime); // higher pitch for punch

//   gain.gain.setValueAtTime(0.35, ctx.currentTime); // louder
//   gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12); // short decay

//   osc.start(ctx.currentTime);
//   osc.stop(ctx.currentTime + 0.12);
// };

// export const playErrorSound = () => {
//   const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
//   if (!AudioContext) return;

//   const ctx = new AudioContext();
//   const osc = ctx.createOscillator();
//   const gain = ctx.createGain();

//   osc.connect(gain);
//   gain.connect(ctx.destination);

//   // Hard error beep
//   osc.type = 'square'; // punchy
//   osc.frequency.setValueAtTime(400, ctx.currentTime); // lower, urgent tone

//   gain.gain.setValueAtTime(0.35, ctx.currentTime); // louder
//   gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); // short decay

//   osc.start(ctx.currentTime);
//   osc.stop(ctx.currentTime + 0.15);
// };
