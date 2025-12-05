(function () {
  console.log('🚀 offer-pdf.js: Filen laddas!');
  
  // Vänta på att jsPDF laddas (eftersom det laddas med defer)
  let initAttempts = 0;
  const maxAttempts = 50; // Max 5 sekunder (50 * 100ms)

  function initOfferPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      initAttempts++;
      if (initAttempts >= maxAttempts) {
        console.error('❌ jsPDF kunde inte laddas efter', maxAttempts, 'försök');
        console.error('Kontrollera att jsPDF-scriptet laddas korrekt');
        return;
      }
      if (initAttempts <= 3) {
        console.warn('⏳ jsPDF ej tillgänglig ännu, försöker igen... (försök', initAttempts, 'av', maxAttempts, ')');
      }
      setTimeout(initOfferPdf, 100);
      return;
    }

    const { jsPDF } = window.jspdf;

    // Hjälpfunktion för prisformatering
    function formatPrice(amount) {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount).replace(/\s/g, '');
    }

    /**
     * Skapar offert-PDF.
     * @param {Object} params
     * @param {Object} params.customer  // fält från getCustomerFields()
     * @param {Object} params.calc      // fält från getCalculatedPriceData()
     * @param {string} params.offerHTML // HTML från generateOfferHTML()
     * @param {Array}  params.partis    // window.partisState.partis
     * @returns {Promise<Blob>}
     */
    window.generateOfferPdf = async function generateOfferPdf({
      customer,
      calc,
      offerHTML,
      partis = [],
    }) {
      const doc = new jsPDF();

      console.log('📄 generateOfferPdf – NY modul används');

      // 1) Plocka ut text + kundblock från offerHTML
      const offerText = (function () {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = offerHTML;

        const content = tempDiv.querySelector('.offer-content, .offer--locked, .offer');
        if (!content) return '';

        const recipient = content.querySelector('.offer-recipient');
        const customerLines = [];

        if (recipient) {
          const rawLines = (recipient.innerText || recipient.textContent || '')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);
          customerLines.push(...rawLines);
          recipient.remove();
        }

        content.querySelectorAll('br').forEach(br => {
          br.replaceWith(document.createTextNode('\n'));
        });

        let text = content.textContent || content.innerText || '';

        let bodyLines = text
          .split('\n')
          .map(line => line.replace(/\s+/g, ' ').trim())
          .filter(line => line.length > 0);

        const processedBodyLines = [];
        bodyLines.forEach(line => {
          processedBodyLines.push(line);
          if (line === 'För anbudet gäller:') {
            processedBodyLines.push('');
          }
        });

        const resultLines = [];
        if (customerLines.length > 0) {
          resultLines.push('Kund');
          resultLines.push(...customerLines);
          resultLines.push('');
        }
        resultLines.push(...processedBodyLines);

        return resultLines.join('\n').trim();
      })();

      if (!offerText) {
        throw new Error('Ingen offertdata att generera PDF från');
      }

      const ensureSpace = extra => {
        if (y + extra > 280) {
          doc.addPage();
          y = 20;
        }
      };

      const today = new Date().toLocaleDateString('sv-SE');

    // HEADER + logga
    try {
      const logo = new Image();
      logo.src = 'assets/images/Sternbecks logotyp.png';
      await new Promise(res => { logo.onload = res; logo.onerror = res; });
      doc.addImage(logo, 'PNG', 150, 10, 40, 40);
    } catch (e) {
      console.warn('Kunde inte ladda logotyp i offert-PDF', e);
    }

    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('Offert', 20, 20);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('Sternbecks Måleri & Fönsterhantverk', 20, 30);
    doc.text(today, 20, 36);

    // KUNDBLOCK
    let y = 50;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Kund', 20, y);
    y += 7;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    const customerLines = [];
    if (customer.company) customerLines.push(customer.company);
    if (customer.contact) customerLines.push(customer.contact);
    if (customer.personnummer) customerLines.push('Personnummer: ' + customer.personnummer);
    if (customer.address) customerLines.push(customer.address);
    if (customer.postal || customer.city) {
      customerLines.push([customer.postal, customer.city].filter(Boolean).join(' '));
    }
    if (customer.fastighet) customerLines.push('Fastighetsbeteckning: ' + customer.fastighet);
    if (customer.phone) customerLines.push('Telefon: ' + customer.phone);
    if (customer.email) customerLines.push('E-post: ' + customer.email);

    customerLines.forEach(line => {
      ensureSpace(6);
      doc.text(line, 20, y);
      y += 6;
    });

    y += 6;

    // ANBUD
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('ANBUD', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    // Filtrera bort priser, rubriker och annat som ska vara i tabeller/block
    const paragraphLines = offerText
      .split('\n')
      .filter(row => {
        const rowTrimmed = row.trim();
        // Ta bort "Kund"-rubriken
        if (rowTrimmed.startsWith('Kund')) return false;
        // Ta bort "För anbudet gäller:"-rubriken
        if (rowTrimmed === 'För anbudet gäller:') return false;
        // Ta bort numrerade villkor
        if (rowTrimmed.match(/^\d\./)) return false;
        // Ta bort tomma rader
        if (rowTrimmed === '') return false;
        // Ta bort priser (PRIS: X KR INKLUSIVE MOMS, PRIS VID GODKÄNT ROTAVDRAG, etc.)
        if (rowTrimmed.match(/^PRIS.*KR/i)) return false;
        if (rowTrimmed.match(/Totalt inkl\. moms/i)) return false;
        if (rowTrimmed.match(/ROT-avdrag.*Ej tillämpligt/i)) return false;
        if (rowTrimmed.match(/ROT-avdrag.*50%/i)) return false;
        if (rowTrimmed.match(/I anbudet ingår material/i)) return false;
        // Ta bort signaturblock (Ludvika datum, Johan Sternbeck, etc.)
        if (rowTrimmed.match(/^Ludvika|^Johan Sternbeck|^Sternbecks Fönsterhantverk|^Lavendelstigen|^77143|^Org\.nr|^Tel\.nr/i)) return false;
        return true;
      });

    paragraphLines.forEach(row => {
      const block = doc.splitTextToSize(row, 170);
      block.forEach(line => {
        ensureSpace(6);
        doc.text(line, 20, y);
        y += 6;
      });
      y += 2;
    });

    // PRISTABELL
    y += 8;
    ensureSpace(20);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Arbetsmoment / artiklar', 20, y);
    doc.text('ex. moms', 190, y, { align: 'right' });

    y += 5;
    doc.setLineWidth(0.3);
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    partis.forEach(p => {
      const name = p.typ || p.type || p.partiType || 'Arbete';
      const priceExVat = (p.pris || 0) / 1.25;
      const price = formatPrice(priceExVat);

      ensureSpace(6);
      doc.text(name, 20, y);
      doc.text(price + ' kr', 190, y, { align: 'right' });
      y += 6;
    });

    y += 4;
    doc.line(20, y, 190, y);
    y += 8;

    // TOTALPRISBLOCK
    ensureSpace(40);
    const blockTop = y;

    doc.setFillColor(240, 240, 240);
    doc.rect(20, blockTop, 170, 30, 'F');

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Totalpris', 30, blockTop + 10);

    doc.setFontSize(16);
    doc.text(formatPrice(calc.total_excl_vat) + ' kr', 190, blockTop + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('ex. moms', 30, blockTop + 16);

    y = blockTop + 38;
    y += 4;

    doc.setFontSize(11);

    doc.text('Pris exkl. moms:', 20, y);
    doc.text(formatPrice(calc.total_excl_vat) + ' kr', 190, y, { align: 'right' });
    y += 7;

    doc.text('Moms:', 20, y);
    doc.text(formatPrice(calc.vat_amount) + ' kr', 190, y, { align: 'right' });
    y += 7;

    doc.text('Totalpris inkl. moms:', 20, y);
    doc.text(formatPrice(calc.total_incl_vat) + ' kr', 190, y, { align: 'right' });
    y += 7;

    if (calc.rot_applicable) {
      doc.text('ROT-avdrag:', 20, y);
      doc.text('-' + formatPrice(calc.rot_deduction) + ' kr', 190, y, { align: 'right' });
      y += 7;
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.text('KUNDEN BETALAR: ' + formatPrice(calc.customer_pays) + ' kr', 20, y);
    y += 10;

    // VILLKOR
    ensureSpace(30);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('För anbudet gäller:', 20, y);
    y += 7;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');

    const conditions = offerText
      .split('\n')
      .filter(row => row.match(/^\d\./));

    conditions.forEach(c => {
      ensureSpace(6);
      doc.text(c, 20, y);
      y += 6;
    });

    y += 8;

    // SIGNATUR
    ensureSpace(40);
    const city = customer.city || 'Ludvika';
    doc.text(`${city} ${today}`, 20, y); y += 6;
    doc.text('Johan Sternbeck', 20, y); y += 6;
    doc.text('Sternbecks Fönsterhantverk i Dalarna AB', 20, y); y += 6;
    doc.text('Lavendelstigen 7', 20, y); y += 6;
    doc.text('77143 Ludvika', 20, y); y += 6;
    doc.text('Org.nr 559389-0717', 20, y); y += 6;
    doc.text('Tel.nr 076-846 52 79 – Företaget innehar F-skatt', 20, y);

    return doc.output('blob');
  };

    console.log('✅ offer-pdf.js modul initierad');
    console.log('✅ window.generateOfferPdf definierad:', typeof window.generateOfferPdf === 'function');
  }

  // Starta initieringen
  console.log('🔧 offer-pdf.js: Startar initiering...');
  console.log('🔧 offer-pdf.js: window.jspdf finns?', !!window.jspdf);
  if (window.jspdf) {
    console.log('🔧 offer-pdf.js: window.jspdf.jsPDF finns?', !!window.jspdf.jsPDF);
  }
  
  // Om jsPDF inte är redo ännu, vänta på DOMContentLoaded eller kör direkt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('🔧 offer-pdf.js: DOMContentLoaded - startar initiering...');
      initOfferPdf();
    });
  } else {
    // DOM är redan laddad, starta initiering direkt
    initOfferPdf();
  }
})();

