type SendEmail = (to: string, subject: string) => Promise<void>;

export async function notifyCustomers(emails: string[], send: SendEmail): Promise<number> {
  for (const email of emails) {
    await send(email, "Your order has shipped");
  }
  return emails.length;
}
