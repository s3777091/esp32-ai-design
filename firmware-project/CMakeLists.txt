# DS-02 AI assistant — ESP-IDF project wrapper.
# The build script assembles a project dir where this file is the root
# CMakeLists and the repo itself becomes ./main (the xiaozhi client component).
cmake_minimum_required(VERSION 3.16)

set(PROJECT_VER "0.1.0")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(ds02)
