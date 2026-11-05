// PIN strength policy. Pure functions only (no Prisma, no next/headers) so both the
// app and prisma/seed.ts can import it.

// Most-guessed PINs that the simple pattern rules below do not already catch (coach-set list).
const COMMON_PINS = new Set([
  "1010", "1357", "2468", "2580", "0852", "7410", "8520", "6969", "4200", "0420", "1004", "1007",
  "1230", "2112", "1221", "3141", "0007", "1122", "2211",
  "112233", "123321", "159753", "789456", "147258", "258369", "000111", "111222",
]);

export function weakPinReason(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "PIN must be 4-6 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Pick a PIN that isn't all the same digit.";
  const d = pin.split("").map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) {
    return "Pick a PIN that isn't a straight run like 1234 or 4321.";
  }
  if (/^(\d{2,3})\1+$/.test(pin)) return "Pick a PIN that isn't a repeating pattern like 1212 or 123123.";
  if (pin.length === 4 && /^(19[89]\d|20[0-3]\d)$/.test(pin)) return "Pick a PIN that isn't a year like 2008.";
  if (COMMON_PINS.has(pin)) return "That PIN is too common. Pick one only you would think of.";
  return null;
}

// Coaches can see the whole roster, so their own PINs must be the full 6 digits.
export function pinProblemFor(role: string, pin: string): string | null {
  const weak = weakPinReason(pin);
  if (weak) return weak;
  if (role === "COACH" && pin.length < 6) return "Coach PINs must be 6 digits.";
  return null;
}
