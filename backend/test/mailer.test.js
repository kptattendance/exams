import test from "node:test";
import assert from "node:assert/strict";

import { htmlToText, senderFor } from "../src/services/mailer.js";

test("the sender address is the signed-in Gmail account; MAIL_FROM gets the replies", () => {
  const env = { SMTP_USER: "103kptqp@gmail.com", MAIL_FROM: '"COE, KPT Mangaluru <coe.kpt@gmail.com>"'.slice(1, -1) };
  assert.deepEqual(senderFor(env), {
    from: { name: "COE, KPT Mangaluru", address: "103kptqp@gmail.com" },
    replyTo: "coe.kpt@gmail.com",
  });
});

test("a verified alias or a matching address is kept as it is", () => {
  const env = { SMTP_USER: "a@gmail.com", MAIL_FROM: "COE <coe@gmail.com>", MAIL_FROM_VERIFIED: "true" };
  assert.deepEqual(senderFor(env), { from: { name: "COE", address: "coe@gmail.com" }, replyTo: undefined });
  assert.deepEqual(senderFor({ SMTP_USER: "a@gmail.com", MAIL_FROM: "COE <A@gmail.com>" }), {
    from: { name: "COE", address: "A@gmail.com" },
    replyTo: undefined,
  });
  assert.equal(senderFor({ SMTP_USER: "a@gmail.com" }).from.address, "a@gmail.com");
});

test("plain-text copy keeps the words and the link", () => {
  const t = htmlToText('<p>Dear A &amp; B,</p><p><a href="https://x.in/p/1" style="c">Sign in</a></p>');
  assert.equal(t, "Dear A & B,\nSign in: https://x.in/p/1");
});
