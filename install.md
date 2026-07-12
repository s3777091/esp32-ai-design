# Cai firmware DS-02 cho ESP32-S3 N16R18

Tai lieu nay dung cho mach ESP32-S3 co 16MB Flash va PSRAM Octal, thuong gap voi module ESP32-S3-WROOM N16R8/N16R18. Cau hinh trong repo hien tai dang build cho `esp32s3`, flash 16MB, PSRAM Octal 80MHz va board overlay `esp-box-3`.

Neu mach cua ban chi la module ESP32-S3 N16R18 rieng, firmware van co the flash, nhung man hinh, mic, loa va nut bam chi chay dung khi chan phan cung trung voi cau hinh `boards/esp-box-3/config.h`. Neu chan khac, can sua board config truoc khi build lai.

## 1. Thong so dang dung

- Chip: `ESP32-S3`
- Flash: `16MB`
- PSRAM: `Octal PSRAM 80MHz`
- Target ESP-IDF: `esp32s3`
- Partition: `firmware-project/partitions_16m.csv`
- Board config: `CONFIG_BOARD_TYPE_ESP_BOX_3=y`
- Ngon ngu: `vi-VN`
- Wake word mac dinh: `okke`
- OTA URL: `https://ai.protexa.cloud/xiaozhi/ota/`

## 2. Can cai tren may tinh

Tren Windows nen cai:

- Git
- Python 3.10 hoac moi hon
- ESP-IDF `v5.5.2` hoac moi hon
- Driver USB-UART cho mach neu Windows khong hien cong COM

Sau khi cai ESP-IDF, mo `ESP-IDF PowerShell` hoac terminal da export moi truong ESP-IDF. Kiem tra:

```powershell
idf.py --version
python -m esptool version
```

## 3. Noi mach vao che do flash

1. Cam mach ESP32-S3 vao may tinh bang cap USB data.
2. Tim cong COM trong Device Manager, vi du `COM5`.
3. Neu flash bi loi ket noi, giu nut `BOOT`, bam/thao nut `RESET` hoac `EN`, sau do tha `BOOT`.

Trong cac lenh ben duoi, thay `COM5` bang cong COM cua ban.

## 4. Flash nhanh bang firmware co san

Repo da co san file build trong `firmware-project/artifacts`. Chay tu thu muc goc repo:

```powershell
cd C:\Users\ekko.huynh\esp32-ai-design
(Get-Item firmware-project\artifacts\generated_assets.bin).Length
```

Gia tri tren phai nho hon hoac bang `8388608` byte vi partition `assets` cua mach 16MB chi co 8MB. Neu lon hon, lenh flash day du se loi; hay build lai voi assets nho hon, hoac dung mach/partition flash lon hon. Neu chi can nap app de debug boot va log serial, co the tam thoi bo phan `0x800000 ... generated_assets.bin`, nhung UI/am thanh/assets co the khong day du.

```powershell
cd C:\Users\ekko.huynh\esp32-ai-design
python -m esptool --chip esp32s3 -p COM5 -b 921600 --before default_reset --after hard_reset write_flash --flash_mode dio --flash_freq 80m --flash_size 16MB 0x0 firmware-project\artifacts\bootloader.bin 0x8000 firmware-project\artifacts\partition-table.bin 0xd000 firmware-project\artifacts\ota_data_initial.bin 0x20000 firmware-project\artifacts\ds02.bin 0x800000 firmware-project\artifacts\generated_assets.bin
```

Neu muon xoa sach flash truoc khi nap:

```powershell
python -m esptool --chip esp32s3 -p COM5 erase_flash
```

Sau do chay lai lenh `write_flash` o tren.

Mo log serial:

```powershell
python -m serial.tools.miniterm COM5 115200
```

Thoat monitor bang `Ctrl+]`.

## 5. Build lai firmware bang Docker/WSL

Cach nay dung script co san `firmware-project/build-on-vm.sh`. Can cai Docker Desktop va bat WSL/Git Bash.

Trong WSL hoac Git Bash:

```bash
cd /mnt/c/Users/ekko.huynh/esp32-ai-design
./firmware-project/build-on-vm.sh "$(pwd)" /tmp/ds02-project
```

Script se tao project ESP-IDF tam tai `/tmp/ds02-project` va build voi cac defaults:

```text
sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.board.esp-box-3
```

Sau khi build xong, cac file quan trong nam o:

```text
/tmp/ds02-project/build/bootloader/bootloader.bin
/tmp/ds02-project/build/partition_table/partition-table.bin
/tmp/ds02-project/build/ota_data_initial.bin
/tmp/ds02-project/build/ds02.bin
/tmp/ds02-project/build/generated_assets.bin
```

Neu muon cap nhat artifact trong repo:

```bash
cp /tmp/ds02-project/build/bootloader/bootloader.bin firmware-project/artifacts/bootloader.bin
cp /tmp/ds02-project/build/partition_table/partition-table.bin firmware-project/artifacts/partition-table.bin
cp /tmp/ds02-project/build/ota_data_initial.bin firmware-project/artifacts/ota_data_initial.bin
cp /tmp/ds02-project/build/ds02.bin firmware-project/artifacts/ds02.bin
cp /tmp/ds02-project/build/generated_assets.bin firmware-project/artifacts/generated_assets.bin
```

Sau do flash lai bang lenh o muc 4.

## 6. Build thu cong bang ESP-IDF

Project nay khong build truc tiep tu root repo. Can tao mot ESP-IDF project co layout nhu sau:

```text
ds02-project/
  CMakeLists.txt
  partitions_16m.csv
  sdkconfig.defaults
  sdkconfig.defaults.esp32s3
  sdkconfig.board.esp-box-3
  scripts/
  main/
```

Trong do:

- `CMakeLists.txt`, `partitions_16m.csv`, `sdkconfig.defaults`, `sdkconfig.board.esp-box-3` lay tu `firmware-project/`
- `sdkconfig.defaults.esp32s3` lay tu root repo
- `scripts/` copy tu root repo
- `main/` la toan bo repo nay

Sau khi tao xong layout, chay trong thu muc `ds02-project`:

```powershell
idf.py -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.board.esp-box-3" set-target esp32s3
idf.py build
idf.py -p COM5 -b 921600 flash monitor
```

## 7. Loi hay gap

### Failed to connect to ESP32-S3

- Kiem tra dung cong COM.
- Dung cap USB co truyen data.
- Giu `BOOT`, bam `RESET/EN`, tha `BOOT`, roi flash lai.
- Giam baud xuong `460800` hoac `115200` neu cap USB kem on dinh.

### PSRAM init failed

- Kiem tra mach co PSRAM that hay khong.
- Cau hinh hien tai can Octal PSRAM.
- Neu module khong phai dong co PSRAM, can build lai va tat `CONFIG_SPIRAM`.

### Boot lap lai hoac loi partition

- Dam bao flash size la `16MB`.
- Dung dung file partition `partition-table.bin`.
- Neu nghi flash cu bi loi, chay `erase_flash` roi nap lai day du bootloader, partition, ota data, app va assets.

### Man hinh/mic/loa khong chay

- Firmware hien tai dung pin cua `ESP-BOX-3`.
- Kiem tra va sua `boards/esp-box-3/config.h` neu mach ESP32-S3 N16R18 cua ban co wiring khac.
- Sau khi sua pin, build lai firmware theo muc 5 hoac muc 6.
