import { describe, expect, it } from "vitest";
import { masquerTelephone } from "./detail-votes";

describe("masquerTelephone", () => {
  it("garde les deux premiers chiffres groupés et les deux derniers", () => {
    expect(masquerTelephone("0707124512")).toBe("07 07 •• •• 12");
    expect(masquerTelephone("+225 07 07 12 45 12")).toBe("07 07 •• •• 12");
  });

  it("ne montre rien d'un numéro absent ou trop court", () => {
    expect(masquerTelephone(null)).toBe("—");
    expect(masquerTelephone("")).toBe("—");
    expect(masquerTelephone("1234")).toBe("••••");
  });
});
