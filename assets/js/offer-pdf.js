(function () {
  // PDF: HELPER – renderar "Antal partier: X st" raden
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

    // PDF: PRICE FORMATTER – här formateras alla priser (kr läggs på senare).
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

    // PDF: CURRENCY FORMATTER – formaterar med svenskt tusentals-mellanslag och "kr"
    function formatCurrency(value) {
      const number = Math.round(Number(value) || 0);
      // sv-SE ger "15 812" (NBSP) utan decimaler med dessa options
      const formatted = number.toLocaleString('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${formatted} kr`;
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

      const today = new Date();
      const todayFormatted = today.toLocaleDateString('sv-SE');
      
      // Beräkna giltig till-datum (30 dagar efter idag)
      const validUntil = new Date(today);
      validUntil.setDate(validUntil.getDate() + 30);
      const validUntilFormatted = validUntil.toLocaleDateString('sv-SE');

      const ensureSpace = extra => {
        if (y + extra > 280) {
          doc.addPage();
          y = 20;
        }
      };

      // ------------------------
      // HEADER – två kolumner
      // ------------------------
      const marginLeft = 20;
      const rightColumnX = 120; // Högerkolumnens startposition
      let headerTop = 20;

      // VÄNSTER KOLUMN – Företag + offertinfo
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text('Offert', marginLeft, headerTop);

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      let leftY = headerTop + 10;
      doc.text('Sternbecks Måleri & Fönsterhantverk', marginLeft, leftY);
      leftY += 6;
      doc.text('Lavendelstigen 7', marginLeft, leftY);
      leftY += 6;
      doc.text('77143 Ludvika', marginLeft, leftY);
      leftY += 6;
      doc.text('Org.nr 559389-0717', marginLeft, leftY);
      leftY += 6;
      doc.text('Tel.nr 076-846 52 79', marginLeft, leftY);
      leftY += 8;

      // Datum, Giltig till
      doc.text('Datum: ' + todayFormatted, marginLeft, leftY);
      leftY += 6;
      doc.text('Giltig till: ' + validUntilFormatted, marginLeft, leftY);

      // HÖGER KOLUMN – Kunduppgifter
      let rightY = headerTop;
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text('Kund', rightColumnX, rightY);
      rightY += 7;

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      if (customer.company) {
        doc.text(customer.company, rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.contact) {
        doc.text(customer.contact, rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.personnummer) {
        doc.text('Personnummer: ' + customer.personnummer, rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.address) {
        doc.text(customer.address, rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.postal || customer.city) {
        doc.text([customer.postal, customer.city].filter(Boolean).join(' '), rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.fastighet) {
        doc.text('Fastighetsbeteckning: ' + customer.fastighet, rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.phone) {
        doc.text('Telefon: ' + customer.phone, rightColumnX, rightY);
        rightY += 6;
      }
      if (customer.email) {
        doc.text('E-post: ' + customer.email, rightColumnX, rightY);
        rightY += 6;
      }

      // Start-Y för brödtexten (efter header)
      y = Math.max(leftY, rightY) + 20;

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

          // Ta bort datumrader (t.ex. "Ludvika 2025-12-10" eller liknande)
          const city = customer.city || 'Ludvika';
          if (row.includes(city) && /^\d{4}-\d{2}-\d{2}/.test(row)) return false;
          if (row.match(/^\d{4}-\d{2}-\d{2}/)) return false; // Datum i början av raden
          if (row.match(/\d{4}-\d{2}-\d{2}/) && row.includes(city)) return false; // Stad + datum

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
      // FÖR ANBUDET GÄLLER
      // ------------------------
      y += 8;
      ensureSpace(30);

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('För anbudet gäller:', 20, y);
      y += 7;

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text('1. Vi ansvarar för rengöring av fönsterglas efter renovering. Ej fönsterputs.', 20, y);
      y += 6;
      doc.text('2. Miljö- och kvalitetsansvarig: Johan Sternbeck', 20, y);
      y += 6;
      doc.text('3. Entreprenörens ombud: Johan Sternbeck', 20, y);
      y += 6;
      doc.text('4. Timtid vid tillkommande arbeten debiteras med 625 kr inkl moms.', 20, y);
      y += 8;

      // ------------------------
      // PRISTABELL
      // ------------------------
      ensureSpace(20);

      y += 5;
      doc.setLineWidth(0.3);
      doc.line(20, y, 190, y);
      y += 6;

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');

      partis.forEach(p => {
        const name = p.typ || p.type || p.partiType || 'Arbete';
        const priceExVat = (p.pris || 0) / 1.25;
        const price = formatCurrency(priceExVat);

        ensureSpace(6);
        doc.text(name, 20, y);
        doc.text(price, 190, y, { align: 'right' });
        y += 6;
      });

      y += 4;
      doc.line(20, y, 190, y);
      y += 8;

      // ------------------------
      // TOTALPRISBLOCK / EX / MOMS / INKL / ROT / KUNDEN BETALAR
      // ------------------------
      const totalPartiesResolved = totalParties || (Array.isArray(partis) ? partis.length : 0);
        // PDF: PRICE BLOCK – FÖRETAGSKUND (bara exkl. moms)
      if (isBusinessCustomer) {
        ensureSpace(30);
        const boxX = 20;
        const boxWidth = 170;
        const amountX = boxX + boxWidth - 20; // Dra in 10 px från kanten
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Prisöversikt', 20, y);
        // PDF: ANTAL PARTIER – rad placeras här i företagskundsgrenen
        y = renderTotalPartiesLine(doc, totalPartiesResolved, 20, y, 6);
        y += 6;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Pris exkl. moms:', 20, y);
        doc.text(formatCurrency(calc.total_excl_vat), amountX, y, { align: 'right' });
        doc.setFont(undefined, 'normal');
        y += 12;
      } else {
        // PDF: PRICE BLOCK – PRIVATKUND (hela prisdelen i boxen, slutpris efter ROT är störst)
        ensureSpace(40);
        const blockTop = y;
        const boxX = 20;
        const boxWidth = 170;
        const lineHeight = 6;

        // Boxhöjd – extra utrymme för alla rader + slutpris
        const boxHeight = totalPartiesResolved > 0 ? 82 : 76;
        doc.setFillColor(240, 240, 240);
        doc.rect(boxX, blockTop, boxWidth, boxHeight, 'F');

        let lineY = blockTop + 10;
        const labelX = boxX + 10;
        const amountX = boxX + boxWidth - 20; // Dra in 10 px från kanten

        // Rubrik
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Prisöversikt', labelX, lineY);

        // Antal partier
        if (totalPartiesResolved > 0) {
          lineY += lineHeight;
          doc.setFontSize(11);
          doc.setFont(undefined, 'normal');
          doc.text(`Antal partier: ${totalPartiesResolved} st`, labelX, lineY);
        }

        // Prisrader (direkt efter antal partier/rubrik)
        lineY += totalPartiesResolved > 0 ? 8 : 12;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        doc.text('Pris exkl. moms:', labelX, lineY);
        doc.text(formatCurrency(calc.total_excl_vat), amountX, lineY, { align: 'right' });

        lineY += lineHeight;
        doc.text('Moms:', labelX, lineY);
        doc.text(formatCurrency(calc.vat_amount), amountX, lineY, { align: 'right' });

        lineY += lineHeight;
        doc.text('Totalpris inkl. moms:', labelX, lineY);
        doc.text(formatCurrency(calc.total_incl_vat), amountX, lineY, { align: 'right' });

        lineY += lineHeight;
        if (calc.rot_applicable) {
          doc.text('ROT-avdrag:', labelX, lineY);
          doc.text('-' + formatCurrency(calc.rot_deduction), amountX, lineY, { align: 'right' });
          lineY += lineHeight;
        }

        // Linje mellan ROT-avdrag och Kund betalar
        const separatorY = lineY + 4;
        doc.setLineWidth(0.2);
        doc.line(labelX, separatorY, boxX + boxWidth - 20, separatorY);

        // Slutrad – Kund betalar (fet, både etikett och belopp, tajtare spacing)
        lineY = separatorY + 5; // Mindre spacing än tidigare
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text('Kund betalar:', labelX, lineY);
        doc.text(formatCurrency(calc.customer_pays), amountX, lineY, { align: 'right' });
        doc.setFont(undefined, 'normal');

        y = blockTop + boxHeight + 4;
      }

      return doc.output('blob');
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfferPdf);
  } else {
    initOfferPdf();
  }
})();
