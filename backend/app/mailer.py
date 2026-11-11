import smtplib
import ssl
from email.message import EmailMessage

from app import config


def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    """Send one email. Never raises: a failed send is logged, not shown to the user."""
    if not config.SMTP_HOST:
        # Dev mode: no SMTP configured, so show the email (and its link) in the backend terminal.
        print("\n" + "=" * 70)
        print(f"[DEV MODE - no SMTP configured] Email to: {to}")
        print(f"Subject: {subject}\n")
        print(text)
        print("=" * 70 + "\n", flush=True)
        return

    msg = EmailMessage()
    msg["From"] = config.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        if config.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=20,
                                  context=ssl.create_default_context()) as s:
                if config.SMTP_USER:
                    s.login(config.SMTP_USER, config.SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as s:
                s.starttls(context=ssl.create_default_context())
                if config.SMTP_USER:
                    s.login(config.SMTP_USER, config.SMTP_PASSWORD)
                s.send_message(msg)
    except Exception as e:  # noqa: BLE001 - we deliberately swallow and log
        print(f"[email] failed to send to {to}: {e}", flush=True)


def _html(heading: str, body: str, button: str, link: str, footer: str) -> str:
    return f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1C1B1A">
  <h2 style="font-family:Georgia,serif;margin:0 0 16px">{heading}</h2>
  <p style="line-height:1.5">{body}</p>
  <p style="margin:24px 0">
    <a href="{link}" style="background:#2F5D50;color:#fff;padding:12px 22px;border-radius:8px;
       text-decoration:none;font-weight:600">{button}</a>
  </p>
  <p style="font-size:13px;color:#5B5752;line-height:1.5">
    If the button doesn't work, copy this link into your browser:<br>{link}</p>
  <p style="font-size:13px;color:#5B5752">{footer}</p>
</div>"""


def send_verification_email(to: str, link: str) -> None:
    send_email(
        to,
        "Verify your DocuAI email",
        f"Welcome to DocuAI!\n\nConfirm your email address to activate your account:\n{link}\n\n"
        "This link expires in 24 hours. If you didn't create an account, ignore this email.",
        _html(
            "Confirm your email",
            "Welcome to DocuAI! Confirm your email address to activate your account.",
            "Verify email",
            link,
            "This link expires in 24 hours. If you didn't create an account, ignore this email.",
        ),
    )


def send_reset_email(to: str, link: str) -> None:
    minutes = config.RESET_MINUTES
    send_email(
        to,
        "Reset your DocuAI password",
        f"We received a request to reset your DocuAI password.\n\nChoose a new password here:\n{link}\n\n"
        f"This link expires in {minutes} minutes and works once. If you didn't ask for this, "
        "you can ignore this email - your password won't change.",
        _html(
            "Reset your password",
            "We received a request to reset your DocuAI password.",
            "Choose a new password",
            link,
            f"This link expires in {minutes} minutes and works once. If you didn't ask for this, "
            "ignore this email and your password won't change.",
        ),
    )