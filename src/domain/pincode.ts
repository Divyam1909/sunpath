// A12: Vidarbha's eleven districts sit inside postal prefixes 440 to 445.
export function isVidarbhaPincode(pincode: string) {
  if (!/^\d{6}$/.test(pincode)) return false;
  const prefix = Number(pincode.slice(0, 3));
  return prefix >= 440 && prefix <= 445;
}
