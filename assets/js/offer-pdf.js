(function () {
  function renderTotalPartiesLine(doc, totalParties, x, y, lineHeight) {
    if (!totalParties || totalParties <= 0) return y;
    doc.setFont(undefined, 'normal');
    y += lineHeight;
    doc.text(`Antal partier: ${totalParties} st`, x, y);
    return y;
  }

  function initOfferPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('❌ jsPDF saknas i window.jspdf.jsPDF. Kontrollera att jspdf.umd.min.js laddas först.');
      return;
    }

    const { jsPDF } = window.jspdf;

    function formatPrice(amount) {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(amount)
        .replace(/\s/g, '');
    }

    /**
     * Skapar offert-PDF.
     * @param {Object} params
     * @param {Object} params.customer  // från getCustomerFields()
     * @param {Object} params.calc      // från getCalculatedPriceData()
     * @param {string} params.offerHTML // från generateOfferHTML()
     * @param {Array}  params.partis    // window.partisState.partis
     * @returns {Promise<Blob>}
     */
    window.generateOfferPdf = async function generateOfferPdf({
      customer,
      calc,
      offerHTML,
      partis = [],
      totalParties = 0,
      isBusinessCustomer = false,
    }) {
      const doc = new jsPDF();

      // ------------------------
      // Steg 1: plocka ut text + kundblock ur offerHTML
      // ------------------------
      const offerText = (function () {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = offerHTML;

        const content = tempDiv.querySelector('.offer-content, .offer--locked, .offer');
        if (!content) return '';

        const recipient = content.querySelector('.offer-recipient');
        if (recipient) {
          // Vi läser ev. kundinfo här om vi vill i framtiden,
          // men vi använder den INTE längre i offerText.
          recipient.remove(); // ta bort så det inte kommer med i bodyLines
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
            processedBodyLines.push(''); // extra tom rad direkt efter rubriken
          }
        });

        // Ingen "Kund"-header här längre, bara ren body-text
        return processedBodyLines.join('\n').trim();
      })();

      if (!offerText) {
        throw new Error('Ingen offertdata att generera PDF från');
      }

      const today = new Date().toLocaleDateString('sv-SE');
      let y = 50;

      const ensureSpace = extra => {
        if (y + extra > 280) {
          doc.addPage();
          y = 20;
        }
      };

      // ------------------------
      // HEADER + logga
      // ------------------------
      try {
        const logo = new Image();
        logo.src = 'assets/images/Sternbecks logotyp.png';
        await new Promise(res => { logo.onload = res; logo.onerror = res; });
        const logoX = 150;
        const logoY = 10;
        const logoDisplayWidth = 60; // större än tidigare (40)
        const aspectRatio = logo.height > 0 ? logo.height / logo.width : 1;
        const logoDisplayHeight = logoDisplayWidth * aspectRatio;
        doc.addImage(logo, 'PNG', logoX, logoY, logoDisplayWidth, logoDisplayHeight);
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

      // ------------------------
      // KUNDBLOCK
      // ------------------------
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

      // ------------------------
      // ANBUDSTEXT (brödtext)
      // ------------------------
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text('ANBUD', 20, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');

      const paragraphLines = offerText
        .split('\n')
        .filter(row => {
          if (!row) return false;

          // Ta bort ev. kvarvarande kund-rader (säkerhetsbälte)
          if (row.startsWith('Kund')) return false;

          // Ta bort enkelrad "ANBUD" – vi har redan rubriken i fetstil via jsPDF
          if (row === 'ANBUD') return false;

          // Ta bort villkorsrubriken – den hanteras i VILLKOR-sektionen
          if (row === 'För anbudet gäller:') return false;

          // Ta bort numrerade villkor (1., 2., 3. ...) – de hanteras också separat
          if (/^\d\./.test(row)) return false;

          // Ta bort alla prisrader – priserna visas i den nya tabellen + totalblocket
          if (row.startsWith('PRIS:')) return false;
          if (row.startsWith('PRIS VID GODKÄNT ROTAVDRAG:')) return false;
          if (row.startsWith('Totalt inkl. moms:')) return false;
          if (row.startsWith('ROT-avdrag')) return false;

          // Kund-relaterade rader som aldrig ska in i ANBUD-brödtexten
          if (customer.company && row.includes(customer.company)) return false;
          if (customer.contact && row.includes(customer.contact)) return false;
          if (customer.address && row.includes(customer.address)) return false;
          if (customer.postal || customer.city) {
            const pcCity = [customer.postal, customer.city].filter(Boolean).join(' ').trim();
            if (pcCity && row.includes(pcCity)) return false;
          }
          if (row.startsWith('Personnummer:')) return false;
          if (row.startsWith('Telefon:')) return false;
          if (row.startsWith('E-post:')) return false;

          // Ta bort företagsinformation som ska bara finnas i signaturblocket
          if (row.includes('Sternbecks Fönsterhantverk i Dalarna AB')) return false;
          if (row.includes('Lavendelstigen 7')) return false;
          if (row.includes('77143 Ludvika')) return false;
          if (row.startsWith('Org.nr')) return false;
          if (row.startsWith('Tel.nr')) return false;
          if (row.includes('Johan Sternbeck')) return false;
          if (row.includes('Företaget innehar F-skatt')) return false;
          if (row.includes('076-846 52 79')) return false;

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

      // ------------------------
      // PRISTABELL
      // ------------------------
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

      // ------------------------
      // TOTALPRISBLOCK / EX / MOMS / INKL / ROT / KUNDEN BETALAR
      // ------------------------
      const totalPartiesResolved = totalParties || (Array.isArray(partis) ? partis.length : 0);
      if (isBusinessCustomer) {
        ensureSpace(30);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Totalpris exkl. moms:', 20, y);
        y = renderTotalPartiesLine(doc, totalPartiesResolved, 20, y, 6);
        y += 6;
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Pris exkl. moms:', 20, y);
        doc.text(formatPrice(calc.total_excl_vat) + ' kr', 190, y, { align: 'right' });
        y += 12;
      } else {
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

        y = renderTotalPartiesLine(doc, totalPartiesResolved, 20, y, 6);

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
      }

      // ------------------------
      // VILLKOR
      // ------------------------
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

      // ------------------------
      // SIGNATURBLOCK
      // ------------------------
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfferPdf);
  } else {
    initOfferPdf();
  }
})();
