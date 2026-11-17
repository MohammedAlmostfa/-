"use strict";

(function () {
  const exportMessage = document.getElementById("exportMessage");
  const exportProgress = document.getElementById("exportProgress");
  const exportProgressBar = document.getElementById("exportProgressBar");
  const membershipCard = document.getElementById("membershipCard");
  const retryButton = document.getElementById("retryButton");
  const downloadButton = document.getElementById("downloadButton");
  const qrContainer = document.getElementById("qrcode");
  const cardLogo = document.getElementById("cardLogo");

  let isExporting = false;
  let archiveBlob = null;
  let archiveFilename = "";

  function firstValue(object, keys, fallback = "") {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }

    return fallback;
  }

  function getMembers(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.members)) return result.members;
    if (result && Array.isArray(result.items)) return result.items;
    throw new Error("استجابة الخادم لا تحتوي على قائمة أعضاء صالحة.");
  }

  function setMessage(message, type) {
    exportMessage.textContent = message;
    exportMessage.classList.toggle("error", type === "error");
    exportMessage.classList.toggle("success", type === "success");
  }

  function setProgress(current, total) {
    const percent = total ? Math.round((current / total) * 100) : 0;
    exportProgress.setAttribute("aria-valuenow", String(percent));
    exportProgressBar.style.width = percent + "%";
  }

  function normalizeInstrument(value) {
    const instruments = {
      trumpet: "ترومبيت",
      tanbour: "طنبور",
      drum: "طنبور",
      ceremonial: "مراسم"
    };

    return instruments[value] || value || "—";
  }

  function renderMember(member) {
    const id = firstValue(member, ["id", "ID", "memberId"]);
    const name = firstValue(member, [
      "fullName",
      "name",
      "الاسم الثلاثي"
    ]);

    if (!id || !name) {
      throw new Error("تعذّر تجهيز بطاقة: يوجد عضو بدون رقم عضوية أو اسم.");
    }

    document.getElementById("memberName").textContent = String(name);
    document.getElementById("memberId").textContent = String(id);
    document.getElementById("memberInstrument").textContent =
      normalizeInstrument(firstValue(member, ["instrument", "الآلة"]));

    document.getElementById("qrMemberId").textContent = String(id);

    qrContainer.replaceChildren();
    new QRCode(qrContainer, {
      text: String(id),
      width: 104,
      height: 104,
      colorDark: "#282321",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M
    });

    membershipCard.classList.remove("hidden");

    return {
      id: String(id),
      name: String(name)
    };
  }

  function safeFilename(value) {
    return value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80) || "member";
  }

  async function waitForLogo() {
    if (cardLogo.complete) {
      return;
    }

    await new Promise(function (resolve) {
      cardLogo.addEventListener("load", resolve, { once: true });
      cardLogo.addEventListener("error", resolve, { once: true });
    });
  }

  async function captureCard() {
    await new Promise(function (resolve) {
      window.requestAnimationFrame(resolve);
    });

    const canvas = await html2canvas(membershipCard, {
      scale: 2,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false
    });

    const blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error("تعذّر إنشاء صورة لإحدى البطاقات.");
    }

    return blob;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function exportAllCards() {
    if (isExporting) return;

    isExporting = true;
    retryButton.classList.add("hidden");
    downloadButton.classList.add("hidden");
    archiveBlob = null;
    setProgress(0, 0);

    try {
      setMessage("جارٍ تحميل قائمة الأعضاء وأدوات إنشاء البطاقات...");

      const members = getMembers(await api("listMembers"));

      if (members.length === 0) {
        throw new Error("لا يوجد أعضاء مسجّلون لتنزيل بطاقاتهم.");
      }

      await Promise.all([
        loadScriptOnce(LIB_URLS.qrcode),
        loadScriptOnce(LIB_URLS.html2canvas),
        loadScriptOnce(LIB_URLS.jszip),
        document.fonts && document.fonts.ready
          ? document.fonts.ready
          : Promise.resolve(),
        waitForLogo()
      ]);

      if (
        typeof QRCode === "undefined" ||
        typeof html2canvas !== "function" ||
        typeof JSZip !== "function"
      ) {
        throw new Error("تعذّر تحميل إحدى أدوات تجهيز البطاقات.");
      }

      const zip = new JSZip();

      for (let index = 0; index < members.length; index++) {
        const member = members[index];
        setMessage("جارٍ تجهيز البطاقة " + (index + 1) + " من " + members.length + "...");

        let renderedMember;
        try {
          renderedMember = renderMember(member);
        } catch (error) {
          throw new Error(
            "تعذّر تجهيز بطاقة العضو رقم " + (index + 1) + ": " + error.message
          );
        }

        const image = await captureCard();
        const filename =
          String(index + 1).padStart(3, "0") + "-" +
          safeFilename(renderedMember.id) + "-" +
          safeFilename(renderedMember.name) + ".png";

        zip.file(filename, image);
        setProgress(index + 1, members.length);
      }

      setMessage("جارٍ إنشاء ملف ZIP...");
      const archive = await zip.generateAsync(
        { type: "blob", compression: "STORE" },
        function (metadata) {
          setMessage("جارٍ إنشاء ملف ZIP... " + Math.round(metadata.percent) + "%");
        }
      );
      const date = new Date().toISOString().slice(0, 10);

      archiveBlob = archive;
      archiveFilename = "hadir-member-cards-" + date + ".zip";
      downloadBlob(archiveBlob, archiveFilename);
      downloadButton.classList.remove("hidden");
      setMessage(
        "تم تجهيز " + members.length + " بطاقة. إذا لم يبدأ التنزيل تلقائياً، اضغط الزر أدناه.",
        "success"
      );
    } catch (error) {
      console.error("Bulk member card export failed:", error);
      setMessage(
        error && error.message
          ? error.message
          : "تعذّر تنزيل البطاقات. تحقق من الاتصال ثم أعد المحاولة.",
        "error"
      );
      retryButton.classList.remove("hidden");
    } finally {
      isExporting = false;
    }
  }

  downloadButton.addEventListener("click", function () {
    if (archiveBlob) {
      downloadBlob(archiveBlob, archiveFilename);
    }
  });

  retryButton.addEventListener("click", exportAllCards);

  if (typeof guard !== "function" || guard(["owner"])) {
    exportAllCards();
  }
})();
