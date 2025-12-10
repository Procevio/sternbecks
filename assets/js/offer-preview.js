window.buildOfferPreview = function buildOfferPreview({
  customer,
  offerBodyText,
  items,
  calc,
  conditions,
  date,
  city,
  totalParties = 0,
  isBusinessCustomer = false
}) {
  const summaryHtml = isBusinessCustomer
    ? `
      <div class="summary-box">
        <h3>Prisöversikt</h3>
        ${totalParties > 0 ? `<div>Antal partier: ${totalParties} st</div>` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span>Pris exkl. moms:</span>
          <span class="right" style="font-weight: bold;">${calc.total_excl_vat} kr</span>
        </div>
      </div>
    `
    : `
      <div class="summary-box">
        <h3>Prisöversikt</h3>
        ${totalParties > 0 ? `<div>Antal partier: ${totalParties} st</div>` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span>Pris exkl. moms:</span>
          <span class="right">${calc.total_excl_vat} kr</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>Moms:</span>
          <span class="right">${calc.vat_amount} kr</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>Totalpris inkl. moms:</span>
          <span class="right">${calc.total_incl_vat} kr</span>
        </div>
        ${calc.rot_applicable ? `
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span>ROT-avdrag:</span>
            <span class="right">-${calc.rot_deduction} kr</span>
          </div>
        ` : ""}
        <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid #ddd;">
          <span style="font-weight: bold; font-size: 13px;">Kund betalar:</span>
          <span class="right" style="font-weight: bold; font-size: 13px;">${calc.customer_pays} kr</span>
        </div>
      </div>
    `;

  // Beräkna giltig till-datum (30 dagar efter idag)
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30);
  const validUntilFormatted = validUntil.toLocaleDateString('sv-SE');

  // Bygg HTML som matchar PDF-layouten strukturellt
  return `
    <div class="offer-preview">

      <div class="preview-header-two-columns">
        <div class="preview-header-left">
          <h1>Offert</h1>
          <div class="preview-company-info">
            <div>Sternbecks Måleri & Fönsterhantverk</div>
            <div>Lavendelstigen 7</div>
            <div>77143 Ludvika</div>
            <div>Org.nr 559389-0717</div>
            <div>Tel.nr 076-846 52 79</div>
          </div>
          <div class="preview-offer-info">
            <div>Datum: ${date}</div>
            <div>Giltig till: ${validUntilFormatted}</div>
          </div>
        </div>
        <div class="preview-header-right">
          <h2>Kund</h2>
          <div class="preview-kund">
            ${customer.company ? '<div>' + customer.company + '</div>' : ''}
            ${customer.contact ? '<div>' + customer.contact + '</div>' : ''}
            ${customer.personnummer ? '<div>Personnummer: ' + customer.personnummer + '</div>' : ''}
            ${customer.address ? '<div>' + customer.address + '</div>' : ''}
            ${customer.postal || customer.city ? '<div>' + [customer.postal, customer.city].filter(Boolean).join(' ') + '</div>' : ''}
            ${customer.fastighet ? '<div>Fastighetsbeteckning: ' + customer.fastighet + '</div>' : ''}
            ${customer.phone ? '<div>Telefon: ' + customer.phone + '</div>' : ''}
            ${customer.email ? '<div>E-post: ' + customer.email + '</div>' : ''}
          </div>
        </div>
      </div>

      <h2>ANBUD</h2>
      <div class="preview-anbud">
        ${offerBodyText}
      </div>

      <div class="preview-conditions-block">
        <div class="preview-conditions-title">För anbudet gäller:</div>
        <div class="preview-conditions-list">
          <div>1. Vi ansvarar för rengöring av fönsterglas efter renovering. Ej fönsterputs.</div>
          <div>2. Miljö- och kvalitetsansvarig: Johan Sternbeck</div>
          <div>3. Entreprenörens ombud: Johan Sternbeck</div>
          <div>4. Timtid vid tillkommande arbeten debiteras med 625 kr inkl moms.</div>
        </div>
      </div>

      <table class="preview-items">
        <thead>
          <tr>
            <th>Arbete enligt bifogad arbetsbeskrivning</th>
            <th class="right">ex. moms</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${i.name}</td>
              <td class="right">${i.priceExVat} kr</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="preview-summary">
        ${summaryHtml}
      </div>

    </div>
  `;
};

