import { describe, expect, it } from "vitest";
import { htmlToText } from "./html";

describe("htmlToText", () => {
  it("removes markup and keeps paragraphs readable", () => {
    expect(htmlToText('<div class="content-intro"><p><strong>Airbnb</strong> began in 2007.</p></div><p>Join us&nbsp;today.</p>'))
      .toBe("Airbnb began in 2007.\nJoin us today.");
  });

  it("removes scripts and decodes encoded text", () => {
    expect(htmlToText("<p>Build &amp; grow</p><script>alert('x')</script><p>Remote &#x1F30D;</p>"))
      .toBe("Build & grow\nRemote 🌍");
  });
});
