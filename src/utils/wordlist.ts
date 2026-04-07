export const words = [
  "ALPHA", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET", "KILO", "LIMA",
  "NEON", "CYBER", "VOID", "GRID", "WIRE", "PULSE", "FLUX", "NODE", "GHOST", "SHADOW",
  "SIGNAL", "TRACE", "LINK", "BASE", "CORE", "APEX", "ZENITH", "NOVA", "ORBIT", "SYNTH",
  "PROXY", "CIPHER", "CRYPT", "HACK", "DATA", "BYTE", "ZULU", "VECTOR", "PRIME", "OMEGA",
  "STORM", "WOLF", "VIPER", "RAVEN", "COBRA", "FALCON", "EAGLE", "HAWK", "TIGER", "BEAR",
  "STONE", "IRON", "STEEL", "GLASS", "CARBON", "QUARTZ", "NEBULA", "PLASMA", "LASER", "BEAM"
];

export function generateRoomCode(): string {
  const getWord = () => words[Math.floor(Math.random() * words.length)];
  return `${getWord()}-${getWord()}-${getWord()}-${getWord()}`;
}
