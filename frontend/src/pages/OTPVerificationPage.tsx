import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";

export default function OTPVerificationPage() {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [timeLeft, setTimeLeft] = useState(83); // 01:23
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <AuthLayout title="OTP Verification" navLabel="Login" navLink="/login">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          We've sent a one-time password to your email. Please enter the 6-digit code below to complete verification.
        </p>

        <div className="flex justify-center gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-11 h-12 text-center text-lg font-semibold rounded-lg bg-secondary border border-input text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Resend in time: <span className="font-medium text-foreground">{formatTime(timeLeft)}</span>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Didn't get the code?{" "}
          <button
            type="button"
            onClick={() => setTimeLeft(83)}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Resend
          </button>
        </p>

        <button
          type="button"
          className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Verify
        </button>

        <Link
          to="/login"
          className="w-full py-3 rounded-lg border border-input bg-card text-muted-foreground font-medium hover:bg-muted transition-colors flex items-center justify-center"
        >
          Cancel
        </Link>
      </div>
    </AuthLayout>
  );
}
