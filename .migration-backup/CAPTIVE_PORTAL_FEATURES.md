# Captive Portal Builder - Enhanced Features Guide

## 🎨 Overview

The Captive Portal Builder has been significantly enhanced with professional-grade features for designing, customizing, and deploying WiFi captive portals for MikroTik hotspots.

---

## ✨ New Features

### 1. **Drag-and-Drop Canvas**
- **Free positioning**: Click and drag any element to reposition it on the canvas
- **Smooth interaction**: Elements move in real-time as you drag
- **Percentage-based positioning**: All positions are stored as percentages for responsive scaling
- **Visual feedback**: Selected elements show a blue ring highlight

**How to use:**
1. Click any element on the canvas to select it
2. Click and hold to drag it to a new position
3. Release to drop it in place

---

### 2. **Resize Handles**
- **Visual handles**: Selected elements show left and right resize handles
- **Width adjustment**: Drag handles to resize element width
- **Minimum width**: Elements maintain a minimum usable width
- **Real-time preview**: Width updates as you drag

**How to use:**
1. Select an element
2. Drag the ◄ or ► handles to adjust width
3. Release when satisfied

---

### 3. **Alignment Guides (Snap Lines)**
- **Smart guides**: Blue alignment lines appear when elements are near center or other elements
- **Snap-to-center**: Elements snap to canvas center automatically
- **Toggle guides**: Turn alignment guides on/off in settings
- **Visual precision**: Helps you align elements pixel-perfectly

**How to use:**
- Drag elements near alignment points
- Blue guide lines appear when snapped
- Toggle in Properties panel → "Show Guides"

---

### 4. **Undo/Redo System**
- **20-state history**: Full undo/redo support with 20 saved states
- **Keyboard shortcuts**: `Ctrl+Z` (undo), `Ctrl+Y` or `Ctrl+Shift+Z` (redo)
- **Visual buttons**: Undo/Redo buttons in header with disabled states
- **Auto-save**: Every action automatically saves to history

**How to use:**
- Click ↶ (Undo) or ↷ (Redo) in header
- Or use keyboard shortcuts
- History is preserved across actions

---

### 5. **Background Image Upload**
- **Custom backgrounds**: Upload your own images (JPG, PNG, WebP)
- **Smart sizing**: Max 2MB file size limit
- **Auto-conversion**: Images converted to base64 for portability
- **Overlay control**: Adjust background opacity for text readability
- **Background types**: Solid color, gradient, or image

**How to use:**
1. Properties panel → Background section
2. Click "Upload Image" button
3. Select image file (max 2MB)
4. Adjust overlay opacity if needed

---

### 6. **Custom Widgets**

#### 🚀 Speed Test Widget
- **Visual design**: Beautiful speed test interface with icon
- **Accent color**: Matches your portal's theme
- **Purpose**: Placeholder for speed test integration
- **Positioning**: Add anywhere on canvas

**How to add:**
- Elements panel → Click "Speed Test"

#### 📢 Promotional Banner
- **Highlighted offers**: Perfect for special deals and promotions
- **Custom styling**: Configurable background and text colors
- **Rounded corners**: Modern card design
- **Examples**: "🔥 50% OFF Daily Pass!", "⭐ Premium: $5/day"

**How to add:**
- Elements panel → Click "Promo Banner"
- Edit text in Properties panel

#### 📣 Announcement Bar
- **Important notices**: Display WiFi info, pricing, or rules
- **Green accent**: Distinctive green color for information
- **Multi-line support**: Longer text for detailed announcements
- **Examples**: "✅ Free 30min trial | Premium: $2/hr"

**How to add:**
- Elements panel → Click "Announcement"

#### 🔗 Social Links
- **Social media icons**: Facebook, Twitter, Instagram icons
- **Configurable URLs**: Set links in Properties panel
- **Custom spacing**: Adjustable icon spacing
- **Icon color**: Match your theme

**How to add:**
- Elements panel → Click "Social Links"
- Properties panel → Set social media URLs

#### 🔐 Social Login
- **Login buttons**: Facebook, Google login placeholders
- **Modern design**: Clean social login interface
- **Divider**: "Or login with" separator
- **Extensible**: Ready for OAuth integration

**How to add:**
- Elements panel → Click "Social Login"

---

### 7. **Multi-Language Support**
- **Built-in translations**: English, Swahili, French
- **Dynamic labels**: All UI text translates automatically
- **Login form**: Username, password, button labels all translate
- **Messages**: Terms, timeout warnings all localized
- **Extensible**: Easy to add more languages

**Available languages:**
- 🇬🇧 English (en)
- 🇰🇪 Swahili (sw)
- 🇫🇷 French (fr)

**How to change:**
1. Properties panel → Settings section
2. Select language from dropdown
3. All text updates automatically

**Translated elements:**
- Login form labels (Username, Password, Connect)
- Terms acceptance checkbox
- Session timeout warnings
- Widget labels (Speed Test, Announcement, Follow Us)
- Error messages

---

### 8. **Terms/Privacy Acceptance**
- **Checkbox option**: Add "I agree to Terms" checkbox to login form
- **Required field**: Users must accept before logging in
- **Translated label**: Automatically translates to selected language
- **Toggle on/off**: Enable/disable in settings

**How to enable:**
1. Properties panel → Settings
2. Toggle "Show Terms Checkbox"
3. Checkbox appears in login form

**Generated HTML includes:**
- Styled checkbox with label
- Required validation
- Translated text
- Proper form integration

---

### 9. **Session Timeout Warnings**
- **Timeout display**: Show session duration on login form
- **Configurable duration**: Set timeout in minutes (default: 60)
- **Warning time**: Set warning threshold (default: 10 minutes)
- **Visual indicator**: Clock icon with timeout info
- **User-friendly**: "60 min session" display

**How to configure:**
1. Properties panel → Settings
2. Toggle "Show Timeout Info"
3. Set "Timeout (minutes)" - e.g., 60
4. Set "Warning (minutes)" - e.g., 10

**Generated HTML includes:**
- Clock icon display
- Session duration text
- Styled info box in login form

---

### 10. **Custom Redirect URLs**
- **Post-login redirect**: Send users to custom URL after login
- **Marketing pages**: Redirect to promotions, welcome page, etc.
- **Hidden field**: Stored in form as `redirect` field
- **Optional**: Leave empty for default behavior

**How to set:**
1. Properties panel → Settings
2. Enter "Redirect URL" - e.g., `https://yoursite.com/welcome`
3. URL included in generated HTML

**Use cases:**
- Welcome page with instructions
- Promotional offers
- Customer portal
- Survey/feedback form

---

### 11. **Enhanced Templates**

#### Blank
- Empty canvas
- Solid dark background
- Start from scratch

#### Modern
- Clean, professional design
- Gradient background
- Logo, welcome text, login form, contact info
- Terms and timeout enabled

#### Colorful
- Vibrant purple gradient
- Promotional banner included
- Social login buttons
- Eye-catching design

#### With Widgets (NEW)
- Complete example with all widget types
- Announcement bar
- Speed test widget
- Social links
- Shows full potential

---

### 12. **Grid System**
- **Grid overlay**: Visual grid lines for precise positioning
- **Snap-to-grid**: Elements snap to grid points
- **Toggle controls**: Show/hide grid, enable/disable snap
- **Configurable size**: Grid spacing adjustable

**How to use:**
1. Properties panel → Canvas Settings
2. Toggle "Show Grid"
3. Toggle "Snap to Grid"
4. Adjust grid size if needed

---

### 13. **Layers Panel**
- **Element list**: View all elements in order
- **Reorder**: Move elements up/down in stack
- **Delete**: Remove elements from layers panel
- **Select**: Click to select element on canvas
- **Icons**: Visual icons for each element type

**How to use:**
- Properties panel → Layers section
- Click element to select
- Use ↑ ↓ buttons to reorder
- Use 🗑 button to delete

---

### 14. **Enhanced Preview**
- **Device selector**: Preview on mobile (375px) or tablet (768px)
- **Full HTML preview**: Complete rendered preview with all features
- **Open in new tab**: View full-size in new window
- **Copy HTML**: Copy generated HTML to clipboard
- **Download HTML**: Save HTML as file

**How to use:**
1. Click "Preview" button in header
2. Select device size
3. View live preview
4. Use action buttons to export

---

## 🎯 Workflow Example

### Creating a Professional Portal

1. **Start with template**
   - Click "withWidgets" template
   - See pre-configured layout with all widgets

2. **Customize background**
   - Upload your brand image
   - Adjust overlay for readability
   - Or use gradient/colors

3. **Arrange elements**
   - Drag elements to position
   - Resize with handles
   - Use alignment guides for precision

4. **Add widgets**
   - Speed test for engagement
   - Promo banner for offers
   - Announcement for info
   - Social links for marketing

5. **Configure settings**
   - Select language
   - Enable terms checkbox
   - Set timeout duration
   - Add redirect URL

6. **Preview and test**
   - Click Preview
   - Test on mobile/tablet views
   - Open in new tab to verify

7. **Save and deploy**
   - Click "Save" to store portal
   - Select MikroTik router
   - Click "Push to Router" to deploy

---

## 🛠️ Properties Panel

### Element Properties (when element selected)
- **Type**: Element type display
- **Content**: Edit text/URL
- **Position**: X, Y coordinates
- **Size**: Width, height
- **Colors**: Text color, background color
- **Typography**: Font size, weight, alignment
- **Actions**: Move up/down, duplicate, delete

### Canvas Properties (no element selected)
- **Background**: Solid/Gradient/Image
- **Colors**: Background color(s), accent color
- **Image**: Upload background image
- **Overlay**: Adjust image opacity
- **Grid**: Show/hide, snap toggle
- **Settings**: Language, terms, timeout, redirect

---

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo action |
| `Delete` | Delete selected element |
| `Esc` | Deselect element |

---

## 💡 Tips & Best Practices

### Design
- ✅ Use alignment guides for centered layouts
- ✅ Keep important content in center area
- ✅ Use overlay on backgrounds for text readability
- ✅ Maintain consistent spacing between elements
- ✅ Test on both mobile and tablet previews

### Performance
- ⚡ Optimize background images (<2MB)
- ⚡ Use WebP format for smaller files
- ⚡ Minimize number of elements for faster loading
- ⚡ Preview before deploying to catch issues

### User Experience
- 👥 Enable terms checkbox for compliance
- 👥 Add timeout info for transparency
- 👥 Use clear, concise text
- 👥 Test translated previews for multi-language
- 👥 Provide redirect URL for better onboarding

### Marketing
- 📢 Use promo banners for upselling
- 📢 Add social links for engagement
- 📢 Include announcements for important info
- 📢 Use speed test widget as engagement tool

---

## 🔧 Technical Details

### Generated HTML Features
- ✅ MikroTik variable compatibility (`$(link-login-only)`, `$(link-orig)`, etc.)
- ✅ Responsive design with mobile-first CSS
- ✅ Backdrop blur effects for modern look
- ✅ Error message display styling
- ✅ Hidden fields for popup and redirect
- ✅ Translated form labels
- ✅ Terms checkbox with validation
- ✅ Timeout information display

### Element Structure
```javascript
{
  id: 'unique-id',
  type: 'logo|text|login-form|image|button|speed-test|promo-banner|announcement|social-links|social-login',
  content: 'Text content or URL',
  x: 50,           // X position as percentage
  y: 50,           // Y position as percentage
  width: 60,       // Width as percentage
  height: 10,      // Height as percentage (for new elements)
  style: {
    color: '#ffffff',
    fontSize: '14px',
    bgColor: 'rgba(24,24,27,0.8)',
    borderRadius: '16px',
    textAlign: 'center',
    // ... other CSS properties
  },
  social: {         // For social-links element
    facebook: 'https://facebook.com/...',
    twitter: 'https://twitter.com/...',
    instagram: 'https://instagram.com/...'
  }
}
```

### Settings Structure
```javascript
{
  language: 'en',           // en, sw, fr
  showTerms: true,          // Show terms checkbox
  showTimeout: true,        // Show timeout info
  redirectUrl: 'https://...', // Post-login redirect
  timeoutMinutes: 60,       // Session duration
  warningMinutes: 10        // Warning before expiry
}
```

---

## 🚀 Future Enhancements

Potential additions:
- [ ] A/B testing for portal designs
- [ ] Analytics integration (Google Analytics, etc.)
- [ ] Live preview on actual device
- [ ] More language translations
- [ ] Custom CSS injection
- [ ] Component library (testimonials, reviews, etc.)
- [ ] Video background support
- [ ] Animated elements
- [ ] QR code generator widget
- [ ] Payment integration (M-Pesa, etc.)

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review generated HTML for errors
3. Test in preview before deploying
4. Verify MikroTik compatibility

---

**Built with ❤️ for ISP and WiFi hotspot providers**
