/* Quote / appointment requests and in-page calling. No build step required. */
(() => {
  'use strict';
  const config = window.AC_FIRE_CONFIG || {};
  const phoneNumber = config.phoneNumber || '+17139988149';
  const phoneDisplay = config.phoneDisplay || '713-998-8149';
  const requestEmail = String(config.requestEmail || '').trim();
  const dialog = document.querySelector('#call-dialog');
  const callStatus = document.querySelector('#call-status');
  const copyNumber = document.querySelector('#copy-phone');
  const phoneField = document.querySelector('#call-number');
  let lastCallTrigger = null;

  // Keep the current page intact in embedded previews and on desktop computers.
  document.querySelectorAll('[data-open-call]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (typeof dialog.showModal !== 'function') return; // Anchor falls back to contact section.
      event.preventDefault();
      lastCallTrigger = link;
      callStatus.textContent = '';
      if (!dialog.open) dialog.showModal();
    });
  });
  document.querySelector('#close-call-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (lastCallTrigger?.isConnected) lastCallTrigger.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  copyNumber.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(phoneNumber);
      callStatus.textContent = 'Phone number copied.';
    } catch {
      phoneField.focus();
      phoneField.select();
      callStatus.textContent = 'Number selected. Copy it, or dial ' + phoneDisplay + ' on your phone.';
    }
  });

  const form = document.querySelector('#service-request-form');
  const controls = document.querySelector('#request-fields');
  const submit = document.querySelector('#request-submit');
  const status = document.querySelector('#request-status');
  const notice = document.querySelector('#request-unavailable');
  const appointmentFields = document.querySelector('#appointment-fields');
  const preferredDate = document.querySelector('#preferred-date');
  const preferredTime = document.querySelector('#preferred-time');
  const service = document.querySelector('#service-type');
  const success = document.querySelector('#request-success');
  const successText = document.querySelector('#request-success-text');
  const newRequest = document.querySelector('#new-request');
  let sending = false;

  function endpointIsValid(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && parsed.hostname === 'formspree.io' && !parsed.port &&
        !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
        /^\/f\/[a-zA-Z0-9]+$/.test(parsed.pathname);
    } catch { return false; }
  }
  const configured = endpointIsValid(config.formEndpoint);
  const mailFallbackConfigured = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail);
  const formAvailable = configured || mailFallbackConfigured;

  function todayInHouston() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function requestType() {
    return form.querySelector('input[name="request_type"]:checked').value;
  }
  function syncRequestType() {
    const appointment = requestType() === 'Appointment';
    appointmentFields.hidden = !appointment;
    appointmentFields.disabled = !appointment;
    preferredDate.required = appointment;
    preferredDate.min = todayInHouston();
    submit.querySelector('span').textContent = appointment ? 'Send appointment request' : 'Send quote request';
    preferredDate.setCustomValidity('');
    preferredDate.removeAttribute('aria-invalid');
    document.querySelector('#preferred-date-error').textContent = '';
  }

  function setStatus(message, type = 'error') {
    status.textContent = message;
    status.dataset.state = type;
    status.hidden = !message;
  }
  function buildEmail(values, type) {
    const lines = [
      'New ' + type.toLowerCase() + ' request from AC Fire Protection website',
      '',
      'Name: ' + values.get('first_name') + ' ' + values.get('last_name'),
      'Phone: ' + values.get('phone'),
      'Email: ' + values.get('email'),
      'Service: ' + values.get('service'),
      'Address: ' + values.get('street_address') + ', ' + values.get('city') + ', ' + values.get('state') + ' ' + values.get('zip_code')
    ];
    if (type === 'Appointment') {
      lines.push('Preferred date: ' + values.get('preferred_date'));
      lines.push('Preferred time: ' + values.get('preferred_time'));
    }
    if (String(values.get('message') || '').trim()) {
      lines.push('');
      lines.push('Additional details:');
      lines.push(String(values.get('message')).trim());
    }
    lines.push('');
    lines.push('Website: ' + (config.website || window.location.href));
    return {
      subject: 'AC Fire Protection - ' + type + ' request',
      body: lines.join('\n')
    };
  }
  function fieldError(field, message) {
    field.setCustomValidity(message);
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    const error = document.querySelector('#' + field.id + '-error');
    if (error) error.textContent = message;
  }
  function validate() {
    preferredDate.min = todayInHouston();
    const fields = [...form.querySelectorAll('input, select, textarea')].filter((field) => field.willValidate);
    fields.forEach((field) => {
      field.setCustomValidity('');
      if (typeof field.value === 'string' && !['radio', 'checkbox', 'date'].includes(field.type)) field.value = field.value.trim();
      let message = '';
      if (field.validity.valueMissing) message = 'Please complete this field.';
      else if (field.validity.typeMismatch && field.type === 'email') message = 'Enter a valid email address.';
      else if (field.validity.patternMismatch && field.id === 'zip-code') message = 'Enter a 5-digit ZIP code, or ZIP+4.';
      else if (field.validity.rangeUnderflow && field === preferredDate) message = 'Choose today or a future date.';
      else if (field.id === 'phone' && (field.value.replace(/\D/g, '').length < 7 || field.value.replace(/\D/g, '').length > 15 || !/^[+\d\s().\-]+$/.test(field.value))) message = 'Enter a valid phone number, including area code.';
      else if (!field.validity.valid) message = 'Please check this field.';
      fieldError(field, message);
    });
    const invalid = fields.find((field) => !field.validity.valid);
    if (invalid) {
      setStatus('Please check the highlighted fields. Your request has not been sent.');
      invalid.focus();
      return false;
    }
    return true;
  }

  form.noValidate = true;
  form.querySelectorAll('input, select, textarea').forEach((field) => {
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') fieldError(field, '');
      if (!sending && status.dataset.state === 'error') setStatus('');
    });
  });
  form.querySelectorAll('input[name="request_type"]').forEach((radio) => radio.addEventListener('change', syncRequestType));
  document.querySelectorAll('[data-request-type], [data-service]').forEach((link) => {
    link.addEventListener('click', () => {
      if (sending) return;
      if (!success.hidden) resetRequest();
      const type = link.dataset.requestType || 'Quote';
      const radio = form.querySelector('input[name="request_type"][value="' + type + '"]');
      if (radio) radio.checked = true;
      if (link.dataset.service) service.value = link.dataset.service;
      syncRequestType();
    });
  });

  function resetRequest() {
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach((field) => fieldError(field, ''));
    form.hidden = false;
    success.hidden = true;
    setStatus('');
    syncRequestType();
  }
  newRequest.addEventListener('click', () => {
    resetRequest();
    document.querySelector('#first-name').focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!validate()) return;
    const type = requestType();
    const values = new FormData(form);
    if (String(values.get('_gotcha') || '').trim()) {
      setStatus('We could not send this request. Please call ' + phoneDisplay + '.');
      return;
    }
    if (!configured) {
      if (!mailFallbackConfigured) {
        setStatus('Online requests are not available yet. Nothing has been sent. Please call ' + phoneDisplay + '.');
        return;
      }
      const email = buildEmail(values, type);
      const href = 'mailto:' + encodeURIComponent(requestEmail) + '?subject=' + encodeURIComponent(email.subject) + '&body=' + encodeURIComponent(email.body);
      window.location.href = href;
      successText.textContent = 'Your email app should open with the request details ready to send. Please send that email, or call ' + phoneDisplay + ' if it does not open.';
      form.hidden = true;
      success.hidden = false;
      success.focus();
      setStatus('');
      return;
    }
    values.set('name', values.get('first_name') + ' ' + values.get('last_name'));
    values.set('website', config.website || 'https://acprotectionhouston.com');
    values.set('time_zone', 'America/Chicago');
    values.set('subject', 'AC Fire Protection — ' + type + ' request');
    if (type !== 'Appointment') {
      values.delete('preferred_date');
      values.delete('preferred_time');
    }
    sending = true;
    controls.disabled = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus('Sending your request…', 'sending');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(config.formEndpoint, {
        method: 'POST', headers: { Accept: 'application/json' }, body: values,
        credentials: 'omit', redirect: 'error', signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        const message = response.status === 429
          ? 'Too many requests right now. Please wait before trying again, or call ' + phoneDisplay + '.'
          : 'Your request was not confirmed. Please check your details and try again, or call ' + phoneDisplay + '.';
        setStatus(message);
        status.focus();
        return;
      }
      successText.textContent = type === 'Appointment'
        ? 'Your appointment request was received. Our team will contact you to confirm availability and a time. Your appointment is not booked yet.'
        : 'Your quote request was received. Our team will contact you using the details you provided.';
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
      setStatus('');
    } catch {
      setStatus('We could not confirm delivery. Your details are still here. Please call ' + phoneDisplay + ' before resubmitting.');
      status.focus();
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      controls.disabled = false;
      submit.disabled = !formAvailable;
      form.removeAttribute('aria-busy');
    }
  });

  notice.hidden = configured;
  if (mailFallbackConfigured && !configured) notice.innerHTML = 'When you submit, your email app will open with the request details ready to send. For direct website delivery, connect the Formspree endpoint.';
  submit.disabled = !formAvailable;
  if (!formAvailable) controls.disabled = true;
  syncRequestType();
})();
