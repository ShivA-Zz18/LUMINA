import { QRCodeSVG } from "qrcode.react";
import { Wallet } from "lucide-react";

export default function UpiPayButton({ payeeName, payeeVPA, amount, note }) {
  const isZeroFee = !amount || amount === 0;

  if (isZeroFee) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium">
        <Wallet size={16} />
        ₹0 — Free! No application fee
      </div>
    );
  }

  const params = new URLSearchParams({
    pa: payeeVPA || "ministry@sbi",
    pn: payeeName || "Government",
    am: amount.toFixed(2),
    cu: "INR",
    tn: note || `Lumina: ${payeeName} fee`,
  });
  const upiLink = `upi://pay?${params.toString()}`;

  return (
    <div className="flex flex-col items-center gap-3 p-4 glass-subtle rounded-xl">
      <QRCodeSVG
        value={upiLink}
        size={120}
        bgColor="transparent"
        fgColor="#a855f7"
        level="M"
      />
      <a
        href={upiLink}
        className="btn-primary text-sm flex items-center gap-2 no-underline"
      >
        <Wallet size={16} />
        Pay ₹{amount} via UPI
      </a>
      <p className="text-xs text-[var(--text-secondary)]">Scan QR or tap to pay</p>
    </div>
  );
}
