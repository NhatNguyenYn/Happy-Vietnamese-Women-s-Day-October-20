let scene, camera, renderer, controls, heartParticles, loadedFont;
let stars, originalHeartPositions, originalStarPositions, targetPositions;
let backgroundMusic, listener;
let secretWishMesh;
let qrcodeInstance = null;
const ringGroups = [];

// ===================================================================
// BẢNG ĐIỀU KHIỂN THỦ CÔNG
// ===================================================================
const CONFIG = {
    particleCount: 20000,
    heartYOffset: 5,
    ringsYOffset: -5,
    
    heartBeat: {
        frequency: 0.005,
        amplitude: 0.05
    },

    starField: {
        starCount: 5000,
        starSize: 0.5,
        shootingStar: {
            count: 5,
            speed: 5,
            tailLength: 0.2
        }        
    },

    fadeIn: {
        speed: 0.005
    },

    cameraIntro: {
        duration: 3
    },

    // =======================================================
    // MỚI: Thêm lại khối này
    // =======================================================
    secretWish: {
        revealDelay: 4, // Hiện ra sau 4s (sau khi intro kết thúc)
        fadeInDuration: 3 // Thời gian để hiện ra hoàn toàn
    }
};
// ===================================================================
// ================================================================
// PHẦN 1: LOGIC "ĐỌC" - CHẠY KHI TẢI TRANG
// ================================================================

// Hàm này sẽ kiểm tra URL và áp dụng các tùy chỉnh nếu có
function applyUrlParameters() {
    const params = new URLSearchParams(window.location.search);

    if (!params.has('wishes')) {
        return;
    }

    document.body.classList.add('viewer-mode');

    // 1. Áp dụng màu sắc (thêm lại dấu '#')
    const heartColorParam = params.get('heartColor');
    const starsColorParam = params.get('starsColor');
    if (heartColorParam) {
        const heartColor = '#' + heartColorParam;
        if (heartParticles) heartParticles.material.color.set(heartColor);
        document.getElementById('heart-color-picker').value = heartColor;
    }
    if (starsColorParam) {
        const starsColor = '#' + starsColorParam;
        if (stars) stars.material.color.set(starsColor);
        document.getElementById('stars-color-picker').value = starsColor;
    }

    // 2. Áp dụng các lời chúc (GIẢI MÃ)
    const wishesParam = params.get('wishes');
    if (wishesParam) {
        const wishes = decodeURIComponent(wishesParam).split('|');
        document.getElementById('wishes-textarea').value = wishes.join('\n');
    }

    // 3. Áp dụng lời nhắn bí mật (GIẢI MÃ)
    const secretWishParam = params.get('secret');
    if (secretWishParam) {
        document.getElementById('secret-wish-input').value = decodeURIComponent(secretWishParam);
    }
    
    // 4. Quan trọng: Sau khi đã điền dữ liệu, gọi updateWishes để dựng lại cảnh 3D
    // Dùng setTimeout để đảm bảo font đã sẵn sàng
    setTimeout(() => {
        updateWishes();
    }, 100); 
}

// --- KHỞI TẠO (PHIÊN BẢN ĐÃ SẮP XẾP LẠI VÀ SỬA LỖI) ---
function init() {
    // ---- PHẦN 1: CÀI ĐẶT 3D ----
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 70, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0x000000); 
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    
    camera.position.set(-30, 0, 35); // Bắt đầu từ bên trái, ngang tầm chữ
    camera.lookAt(0, 0, 0);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0); 
    
    // MỚI: Vô hiệu hóa điều khiển của người dùng lúc đầu
    controls.enabled = false;

    // ---- PHẦN 2: TẠO CÁC ĐỐI TƯỢNG 3D VÀ ÂM THANH ----
    createSolidHeart();
    createStarfield();
    loadFontAndUpdate();
    setupAudio();

    // ================================================================
    // PHẦN 3: LOGIC GIAO DIỆN NGƯỜI DÙNG (UI)
    // ================================================================

    // BƯỚC A: Lấy TẤT CẢ các phần tử HTML cần thiết lên ĐẦU TIÊN
    const updateButton = document.getElementById('update-button');
    const featuresButton = document.getElementById('features-button');
    const settingsMenu = document.getElementById('settings-menu');
    const heartColorPicker = document.getElementById('heart-color-picker');
    const starsColorPicker = document.getElementById('stars-color-picker');
    const creditsButton = document.getElementById('credits-button');
    const creditsPopup = document.getElementById('credits-popup');
    const closePopupButton = document.getElementById('close-popup-button');
    const musicToggleButton = document.getElementById('music-toggle-button');

    // BƯỚC B: Gán các sự kiện cho từng phần tử (với rào chắn an toàn)
    
    if (updateButton) {
        updateButton.addEventListener('click', updateWishes);
    }
    
    if (featuresButton && settingsMenu) {
        settingsMenu.classList.remove('hidden');
        featuresButton.addEventListener('click', () => {
            settingsMenu.classList.toggle('visible');
        });
    }

    if (heartColorPicker) {
        heartColorPicker.addEventListener('input', (event) => {
            if (heartParticles) {
                heartParticles.material.color.set(new THREE.Color(event.target.value));
            }
        });
    }

    if (starsColorPicker) {
        starsColorPicker.addEventListener('input', (event) => {
            if (stars) {
                stars.material.color.set(new THREE.Color(event.target.value));
            }
        });
    }

    if (creditsButton && creditsPopup && settingsMenu) {
        creditsPopup.classList.remove('hidden');

        creditsButton.addEventListener('click', () => {
            settingsMenu.classList.remove('visible');
            creditsPopup.classList.add('visible');
        });
    }

    if (closePopupButton && creditsPopup) {
        closePopupButton.addEventListener('click', () => {
            creditsPopup.classList.remove('visible');
        });
    }

    if (musicToggleButton) {
        musicToggleButton.addEventListener('click', () => {
            // Kiểm tra xem backgroundMusic đã được tải xong chưa
            if (backgroundMusic && backgroundMusic.buffer) {
                if (backgroundMusic.isPlaying) {
                    backgroundMusic.pause();
                    musicToggleButton.textContent = '🔇';
                } else {
                    backgroundMusic.play();
                    musicToggleButton.textContent = '🔊';
                }
            }
        });
    }
// ================================================================
    // LOGIC CHO NÚT TẠO LINK & QR (PHIÊN BẢN CUỐI CÙNG VỚI by.com.vn)
    // ================================================================
    const generateLinkButton = document.getElementById('generate-link-button');
    const qrPopup = document.getElementById('qr-popup');
    const closeQrPopupButton = document.getElementById('close-qr-popup-button');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const shareableLinkInput = document.getElementById('shareable-link-input');

    if (generateLinkButton) {
        generateLinkButton.addEventListener('click', () => {
            // 1. Thu thập dữ liệu tùy chỉnh (không đổi)
            const heartColor = document.getElementById('heart-color-picker').value;
            const starsColor = document.getElementById('stars-color-picker').value;
            const secretWish = document.getElementById('secret-wish-input').value;
            const wishes = document.getElementById('wishes-textarea').value.split('\n').filter(line => line.trim() !== '');

            // 2. Xây dựng chuỗi tham số URL (không đổi)
            const params = new URLSearchParams();
            params.set('heartColor', heartColor.substring(1));
            params.set('starsColor', starsColor.substring(1));
            params.set('secret', encodeURIComponent(secretWish));
            params.set('wishes', encodeURIComponent(wishes.join('|')));

            // 3. Tạo link dài ban đầu (không đổi)
            const baseUrl = window.location.origin + window.location.pathname;
            const longUrl = `${baseUrl}?${params.toString()}`;

            // 4. MỚI: Xây dựng link rút gọn bằng dịch vụ by.com.vn
            // Chúng ta phải mã hóa toàn bộ link dài để nó trở thành một giá trị tham số hợp lệ
            const shortUrl = `https://by.com.vn/q/?u=${encodeURIComponent(longUrl)}`;

            // --------------------------------------------------------
            // BẮT ĐẦU PHẦN SỬA LỖI QUAN TRỌNG
            // --------------------------------------------------------

            // Hiển thị link trong ô input
            shareableLinkInput.value = shortUrl;

            // BƯỚC A: Dọn dẹp triệt để mã QR cũ
            if (qrcodeInstance) {
                qrcodeInstance.clear(); // Sử dụng phương thức clear() của thư viện
            }
            qrcodeContainer.innerHTML = ''; // Dọn dẹp thêm các phần tử DOM còn sót lại

            // BƯỚC B: Tạo mã QR mới và lưu lại instance để có thể dọn dẹp ở lần sau
            try {
                qrcodeInstance = new QRCode(qrcodeContainer, {
                    text: shortUrl,
                    width: 256,
                    height: 256,
                });
            } catch (e) {
                console.error("Lỗi nghiêm trọng khi tạo mã QR:", e);
                alert("Đã xảy ra lỗi khi tạo mã QR. Vui lòng thử làm mới trang.");
                return; // Dừng lại nếu có lỗi
            }
            
            // Hiện popup
            qrPopup.classList.remove('hidden');
            qrPopup.classList.add('visible');
        });
    }

    // Bắt đầu vòng lặp animation
    animate();
    
    // Bắt đầu hành trình
    startCameraJourney();
}
// ================================================================
// MỚI: HÀM TẠO NỀN TRỜI SAO
// ================================================================
function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    const sphereRadius = 500; // Đặt các ngôi sao trên một mặt cầu lớn

    for (let i = 0; i < CONFIG.starField.starCount; i++) {
        // Tạo một điểm ngẫu nhiên trên bề mặt của một hình cầu
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u; // Góc phương vị (0 đến 2PI)
        const phi = Math.acos(2 * v - 1); // Góc thiên đỉnh (0 đến PI)

        const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
        const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
        const z = sphereRadius * Math.cos(phi);
        
        starPositions.push(x, y, z);
    }
    originalStarPositions = new Float32Array(starPositions); // <-- LƯU LẠI VỊ TRÍ GỐC
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: CONFIG.starField.starSize,
        transparent: true,
        opacity: 0.8,
        // Ngăn các ngôi sao bị ảnh hưởng bởi sương mù, để chúng luôn ở hậu cảnh
        fog: false 
    });

    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// --- TẠO TRÁI TIM 3D ---
function createSolidHeart() {
    const particleCount = CONFIG.particleCount; 
    const positions = new Float32Array(particleCount * 3);
    
    // MỚI: Chuẩn bị mảng để lưu vị trí nổ tung
    targetPositions = new Float32Array(particleCount * 3); 
    const sphereRadius = 100;

    let i = 0; const scale = 18;
    while (i < particleCount) {
        // ... (phần tính toán vị trí trái tim không đổi)
        const x = (Math.random() - 0.5) * 4; const y = (Math.random() - 0.5) * 4; const z = (Math.random() - 0.5) * 4;
        const term1 = x * x + 2.25 * y * y + z * z - 1;
        const term2 = x * x * z * z * z; const term3 = 2.25 * 0.1 * y * y * z * z * z;
        if (Math.pow(term1, 3) - term2 - term3 < 0) {
            const index = i * 3;
            positions[index] = x * scale;
            positions[index + 1] = z * scale + CONFIG.heartYOffset; 
            positions[index + 2] = y * scale;

            // MỚI: Tính toán và lưu sẵn vị trí nổ tung cho mỗi hạt
            const target = new THREE.Vector3();
            target.setFromSphericalCoords(
                sphereRadius * (1 + (Math.random() - 0.5) * 0.2),
                Math.acos(1 - 2 * Math.random()),
                2 * Math.PI * Math.random()
            );
            targetPositions[index] = target.x;
            targetPositions[index + 1] = target.y;
            targetPositions[index + 2] = target.z;

            i++;
        }
    }

    originalHeartPositions = positions.slice(); 

    const particles = new THREE.BufferGeometry();
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0xff3366, size: 0.3, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 });
    heartParticles = new THREE.Points(particles, particleMaterial);
    scene.add(heartParticles);
}
function startAllAnimations() {
    startCameraJourney();

    // Dùng GSAP để làm lời nhắn bí mật từ từ hiện ra sau một khoảng thời gian
    // Chúng ta đặt logic này ở đây thay vì trong createSecretWish
    if (secretWishMesh) {
        gsap.to(secretWishMesh.material, {
            opacity: 1,
            duration: CONFIG.secretWish.fadeInDuration,
            delay: CONFIG.secretWish.revealDelay
        });
    }
}
// ================================================================
// HÀNH TRÌNH CAMERA (PHIÊN BẢN ĐƠN GIẢN VÀ AN TOÀN)
// ================================================================
function startCameraJourney() {
    if (!controls || !camera) return;

    // Tắt điều khiển của người dùng lúc đầu
    controls.enabled = false;

    // Đặt vị trí bắt đầu
    camera.position.set(-80, -10, 20);
    
    // Đặt vị trí cuối cùng
    const finalPosition = { x: 0, y: 45, z: 60 };
    
    // Tạo MỘT animation DUY NHẤT để di chuyển camera
    gsap.to(camera.position, {
        x: finalPosition.x,
        y: finalPosition.y,
        z: finalPosition.z,
        // THAY ĐỔI QUAN TRỌNG: Giảm thời gian xuống còn 3 giây
        duration: 3, 
        ease: "power2.inOut",
        onUpdate: () => {
            // Luôn luôn bắt camera nhìn vào trung tâm
            camera.lookAt(0, 0, 0);
        },
        onComplete: () => {
            // Khi animation kết thúc, bật lại điều khiển
            controls.enabled = true;
            // Và đặt lại target của controls để việc xoay/zoom hoạt động đúng
            controls.target.set(0, 0, 0);
        }
    });
}
// --- HÀM TẠO CHỮ ---

function loadFontAndUpdate() {
    const fontLoader = new THREE.FontLoader();
    const updateButton = document.getElementById('update-button');
    updateButton.disabled = true;

    fontLoader.load('./vietnamese_font.json', (font) => {
        loadedFont = font;
        updateButton.disabled = false;
        
        // **THAY ĐỔI QUAN TRỌNG**: Áp dụng các tham số từ URL TRƯỚC KHI làm bất cứ điều gì khác
        applyUrlParameters(); 

        // Nếu không có tham số nào, thì chạy như bình thường
        if (!document.body.classList.contains('viewer-mode')) {
             updateWishes();
             startAllAnimations();
        }

    }, undefined, (error) => { console.error('Không thể tải font:', error); });
}
// ================================================================
// MỚI: HÀM TẢI VÀ PHÁT NHẠC
// ================================================================
function setupAudio() {
    // 1. Tạo một AudioListener và thêm nó vào camera
    listener = new THREE.AudioListener();
    camera.add(listener);

    // 2. Tạo một đối tượng âm thanh toàn cục
    backgroundMusic = new THREE.Audio(listener);

    // 3. Tải tệp âm thanh
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('audio/background_music.mp3', function(buffer) {
        backgroundMusic.setBuffer(buffer);
        backgroundMusic.setLoop(true); // Lặp lại nhạc khi hết
        backgroundMusic.setVolume(0.5); // Đặt âm lượng (từ 0 đến 1)

        // QUAN TRỌNG: Trình duyệt hiện đại yêu cầu người dùng tương tác
        // (click, gõ phím, v.v.) trước khi âm thanh được phép phát.
        // Chúng ta sẽ lắng nghe sự kiện click đầu tiên trên toàn trang.
        const playAudioOnFirstClick = () => {
            if (!backgroundMusic.isPlaying) {
                backgroundMusic.play();
                // Gỡ bỏ sự kiện sau lần click đầu tiên
                document.removeEventListener('click', playAudioOnFirstClick);
            }
        };
        document.addEventListener('click', playAudioOnFirstClick);
    },
    // Hàm callback cho quá trình tải (không cần làm gì)
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    // Hàm callback khi có lỗi
    function (err) {
        console.log('An error happened while loading audio');
    });
}
function createTextRings(wishes) {
    if (!loadedFont || wishes.length === 0) return;

    const numberOfRings = 4;
    const baseRadius = 20;
    const radiusStep = 7;
    
    // **SỬ DỤNG GIÁ TRỊ TỪ BẢNG ĐIỀU KHIỂN**
    const yPos = CONFIG.ringsYOffset; 
    
    const gapWidth = 4;
    // THAY ĐỔI: Tạo một material duy nhất cho tất cả các vòng để fade in đồng bộ
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false}); // Bắt đầu với opacity = 0
    for (let i = 0; i < numberOfRings; i++) {
        const ringGroup = new THREE.Group();
        const radius = baseRadius + i * radiusStep;
        const scaleFactor = 1.0 + (i / numberOfRings) * 0.2;
        const fontSize = 2.5 * scaleFactor;
        const fontHeight = 0.5 * scaleFactor;
        const wish = wishes[i % wishes.length];
        const textGeo = new THREE.TextGeometry(wish, { font: loadedFont, size: fontSize, height: fontHeight, });
        textGeo.center();
        textGeo.computeBoundingBox();
        const blockWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
        const circumference = 2 * Math.PI * radius;
        const repeats = Math.floor(circumference / (blockWidth + gapWidth));
        let currentAngle = 0;
        const gapAngle = gapWidth / radius;

        for (let j = 0; j < repeats; j++) {
            const angularWidth = blockWidth / radius;
            const placementAngle = currentAngle + angularWidth / 2;
            const clonedGeo = textGeo.clone(); 
            const positions = clonedGeo.attributes.position;
            for (let k = 0; k < positions.count; k++) {
                const originalX = positions.getX(k); const originalY = positions.getY(k); const originalZ = positions.getZ(k);
                const angleOffset = originalX / radius;
                const finalAngle = placementAngle - angleOffset;
                const newX = (radius - originalZ) * Math.cos(finalAngle);
                const newZ = (radius - originalZ) * Math.sin(finalAngle);
                positions.setXYZ(k, newX, originalY, newZ);
            }
            clonedGeo.computeVertexNormals();
            const textMesh = new THREE.Mesh(clonedGeo, textMaterial);
            ringGroup.add(textMesh);
            currentAngle += angularWidth + gapAngle;
        }

        ringGroup.position.y = yPos;
        const baseSpeed = 0.1; 
        const speed = (i % 2 === 0 ? baseSpeed : -baseSpeed) * (1 - i * 0.2); 
        ringGroup.userData.rotationSpeed = speed;
        scene.add(ringGroup);
        ringGroups.push(ringGroup);
    }
}

function removeTextRings() {
    ringGroups.forEach(group => {
        while(group.children.length > 0){ 
            const mesh = group.children[0];
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if(mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            group.remove(mesh); 
        }
        scene.remove(group);
    });
    if(ringGroups.length > 0 && ringGroups[0].children.length > 0) {
        ringGroups[0].children[0].material.dispose();
    }
    ringGroups.length = 0;
}

function updateWishes() {
    removeTextRings();
    const wishesText = document.getElementById('wishes-textarea').value;
    const wishes = wishesText.split('\n').filter(line => line.trim() !== '');
    createTextRings(wishes);
    createSecretWish();
    secretWishMesh = createSecretWish();
}

// --- VÒNG LẶP ANIMATION (PHIÊN BẢN AN TOÀN) ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const time = Date.now();

    // Logic nhịp đập của tim (không đổi)
    if (heartParticles) {
        const beatTime = time * CONFIG.heartBeat.frequency;
        const scale = 1 + Math.sin(beatTime) * CONFIG.heartBeat.amplitude;
        heartParticles.scale.set(scale, scale, scale);
        heartParticles.rotation.y += 0.002;
    }

    // Logic fade in của chữ (không đổi)
    if (ringGroups.length > 0 && ringGroups[0].children.length > 0) {
        const material = ringGroups[0].children[0].material;
        if (material.opacity < 0.9) {
            material.opacity += CONFIG.fadeIn.speed;
        }
    }
    
    // Logic xoay chữ (không đổi)
    ringGroups.forEach(group => {
        group.rotation.y += group.userData.rotationSpeed * 0.005;
    });

    // ================================================================
    // LOGIC SAO BĂNG (ĐÃ THÊM RÀO CHẮN AN TOÀN)
    // ================================================================
    // **RÀO CHẮN:** Chỉ chạy khi 'stars' và các thuộc tính của nó đã tồn tại
    if (stars && stars.geometry && stars.geometry.attributes.position) {
        const positions = stars.geometry.attributes.position;
        const starCount = positions.count;

        for (let i = 0; i < CONFIG.starField.shootingStar.count; i++) {
            const starIndex = (Math.floor(time * 0.0001) + i * 137) % starCount;
            const x = positions.getX(starIndex);
            const y = positions.getY(starIndex);
            const z = positions.getZ(starIndex);

            const newX = x - CONFIG.starField.shootingStar.speed;
            const newY = y - CONFIG.starField.shootingStar.speed * 0.5;
            
            if (newX < -500 || newY < -500) {
                const originalIndex = starIndex * 3;
                positions.setXYZ(starIndex, 
                    originalStarPositions[originalIndex], 
                    originalStarPositions[originalIndex + 1], 
                    originalStarPositions[originalIndex + 2]
                );
            } else {
                positions.setXYZ(starIndex, newX, newY, z);
                const tailIndex = (starIndex + 1) % starCount;
                const tailX = originalStarPositions[tailIndex * 3];
                const tailY = originalStarPositions[tailIndex * 3 + 1];
                const tailZ = originalStarPositions[tailIndex * 3 + 2];
                positions.setXYZ(tailIndex, 
                    tailX + (newX - tailX) * CONFIG.starField.shootingStar.tailLength,
                    tailY + (newY - tailY) * CONFIG.starField.shootingStar.tailLength,
                    tailZ
                );
                const tail2Index = (starIndex + 2) % starCount;
                positions.setXYZ(tail2Index, 
                    originalStarPositions[tail2Index * 3], 
                    originalStarPositions[tail2Index * 3 + 1], 
                    originalStarPositions[tail2Index * 3 + 2]
                );
            }
        }
        positions.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);

// ================================================================
// HÀM BÙNG NỔ TRÁI TIM (PHIÊN BẢN TỐI ƯU HÓA)
// ================================================================
let isExploding = false;

// Tạo một đối tượng "proxy" để GSAP có thể điều khiển
const animationProxy = { progress: 0 }; 

function explodeHeart() {
    if (isExploding || !heartParticles) return;
    isExploding = true;
    
    // Tạo MỘT animation duy nhất điều khiển biến "progress"
    gsap.to(animationProxy, {
        progress: 1, // Đi từ 0 đến 1
        duration: 2.0,
        ease: "power2.out",
        yoyo: true, // Tự động chạy ngược lại
        repeat: 1,  // Lặp lại 1 lần (1 lần đi ra, 1 lần đi về)
        repeatDelay: 0.5, // Nghỉ 0.5s trước khi bay về
        ease: "power3.inOut",
        onUpdate: () => {
            // Hàm này được gọi 60 lần/giây trong suốt quá trình animation
            const positions = heartParticles.geometry.attributes.position;
            
            for (let i = 0; i < positions.count; i++) {
                const index = i * 3;
                
                // Lấy vị trí gốc và vị trí đích
                const ox = originalHeartPositions[index];
                const oy = originalHeartPositions[index + 1];
                const oz = originalHeartPositions[index + 2];
                
                const tx = targetPositions[index];
                const ty = targetPositions[index + 1];
                const tz = targetPositions[index + 2];

                // Dùng công thức nội suy tuyến tính (Lerp) để tính vị trí hiện tại
                const currentX = ox + (tx - ox) * animationProxy.progress;
                const currentY = oy + (ty - oy) * animationProxy.progress;
                const currentZ = oz + (tz - oz) * animationProxy.progress;

                positions.setXYZ(i, currentX, currentY, currentZ);
            }
            positions.needsUpdate = true; // Cập nhật buffer một lần duy nhất
        },
        onComplete: () => {
            isExploding = false;
        }
    });
}

// ================================================================
// MỚI: HÀM TẠO VÀ LÀM HIỆN LỜI NHẮN BÍ MẬT
// ================================================================
function createSecretWish() {
    // Nếu lời nhắn cũ đang tồn tại, hãy xóa nó đi
    if (secretWishMesh) {
        scene.remove(secretWishMesh);
        if (secretWishMesh.geometry) secretWishMesh.geometry.dispose();
        if (secretWishMesh.material) secretWishMesh.material.dispose();
    }

    const secretWishText = document.getElementById('secret-wish-input').value;
    if (!secretWishText || !loadedFont) return null; // Trả về null nếu không tạo được

    const textGeo = new THREE.TextGeometry(secretWishText, {
        font: loadedFont, size: 3, height: 0.8,
    });
    textGeo.center();
    const textMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0,
        fog: false 
    });

    // Tạo mesh cục bộ, không gán vào biến toàn cục ở đây
    const mesh = new THREE.Mesh(textGeo, textMaterial);
    mesh.position.y = CONFIG.heartYOffset;
    scene.add(mesh);

    return mesh; // <-- TRẢ VỀ MESH
}
// Thêm sự kiện click
window.addEventListener('click', explodeHeart);

// --- BẮT ĐẦU ---
init();