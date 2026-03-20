import threading
import time
from config import cfg

# Try RPi.GPIO — only works on real hardware, fails silently on dev machines
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in [cfg.GPIO_GREEN, cfg.GPIO_AMBER, cfg.GPIO_RED, cfg.GPIO_BUZZER]:
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.LOW)
    _HW = True
    print("[gpio] Hardware mode — RPi.GPIO loaded")
except Exception as e:
    _HW = False
    print(f"[gpio] Simulation mode — {e}")


def _write(pin: int, state: bool):
    if _HW:
        try:
            import RPi.GPIO as GPIO
            GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)
        except Exception as err:
            print(f"[gpio] Write error pin {pin}: {err}")
    else:
        print(f"[gpio-sim] pin {pin} → {'ON' if state else 'OFF'}")


_stop          = threading.Event()
_buzzer_thread = None


def set_alert(status: str):
    """
    status: healthy | watch | alert | critical
    Maps directly to dataService.js getStatus() return values.
    """
    global _buzzer_thread

    # Stop previous buzzer pattern
    _stop.set()
    if _buzzer_thread and _buzzer_thread.is_alive():
        _buzzer_thread.join(timeout=2)
    _stop.clear()
    _write(cfg.GPIO_BUZZER, False)

    # LEDs
    _write(cfg.GPIO_GREEN, status == "healthy")
    _write(cfg.GPIO_AMBER, status == "watch")
    _write(cfg.GPIO_RED,   status in ("alert", "critical"))

    # Buzzer patterns
    if status == "alert":
        def _pat():
            while not _stop.is_set():
                _write(cfg.GPIO_BUZZER, True)
                time.sleep(0.3)
                _write(cfg.GPIO_BUZZER, False)
                _stop.wait(10)
        _buzzer_thread = threading.Thread(target=_pat, daemon=True)
        _buzzer_thread.start()

    elif status == "critical":
        def _pat():
            s = False
            while not _stop.is_set():
                s = not s
                _write(cfg.GPIO_BUZZER, s)
                time.sleep(0.5)
        _buzzer_thread = threading.Thread(target=_pat, daemon=True)
        _buzzer_thread.start()

    print(f"[alert] → {status}")


def cleanup():
    _stop.set()
    if _HW:
        try:
            import RPi.GPIO as GPIO
            GPIO.cleanup()
        except Exception:
            pass